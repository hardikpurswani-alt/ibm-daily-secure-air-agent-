"""Specialist Agent C: Forecasting Agent — Trend analysis, uncertainty quantification & early alerts."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from ..schemas.airguard import (
    ForecastPointSchema,
    ForecastResponse,
    HistoricalPoint,
    LiveAQIResponse,
    ReasoningMode,
    UnhealthyWindow,
)
from ..services import aqi_sources
from ..services.granite_service import granite_service
from ..services.rag_service import rag_engine


class ForecastingAgent:
    """Analyzes historical + Open-Meteo 72h forecasts with explicit uncertainty intervals."""

    async def generate(
        self,
        live: LiveAQIResponse,
        historical: List[HistoricalPoint],
        horizon_hours: int = 48,
    ) -> ForecastResponse:
        bundle = await aqi_sources.fetch_open_meteo_bundle(live.location.latitude, live.location.longitude)
        air = bundle["air"]
        hourly = air.get("hourly", {})
        times: List[str] = hourly.get("time", [])
        us_aqi_arr = hourly.get("us_aqi", [])
        pm25_arr = hourly.get("pm2_5", [])
        pm10_arr = hourly.get("pm10", [])
        o3_arr = hourly.get("ozone", [])

        current_time = (air.get("current") or {}).get("time") or ""
        start_idx = 0
        if current_time in times:
            start_idx = times.index(current_time) + 1
        else:
            now_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
            future_indices = [i for i, t in enumerate(times) if t[:13] > now_prefix]
            if future_indices:
                start_idx = future_indices[0]

        # Compute recent volatility from real historical series to inform uncertainty bands
        hist_aqi = [h.aqi for h in historical if h.aqi is not None]
        if len(hist_aqi) >= 4:
            diffs = [abs(hist_aqi[i] - hist_aqi[i - 1]) for i in range(1, len(hist_aqi))]
            mean_step_vol = sum(diffs) / len(diffs)
        else:
            mean_step_vol = 6.0

        # Offset calibration if official CPCB station diverges slightly from Open-Meteo grid baseline
        om_now_aqi = live.us_aqi or (live.aqi or 50)
        station_offset = 0.0
        if live.india_naqi is not None and live.us_aqi is not None:
            # Decay station calibration gradually over 18h so short-term horizon tracks station bias without distorting 48h model
            station_offset = max(-45.0, min(65.0, float(live.india_naqi - live.us_aqi)))

        wind_kmh = (live.meteorology.wind_speed_kmh if live.meteorology else None) or 8.0
        forecasts: List[ForecastPointSchema] = []

        for step, i in enumerate(range(start_idx, min(start_idx + horizon_hours, len(times)))):
            raw_pred = us_aqi_arr[i] if i < len(us_aqi_arr) else None
            if raw_pred is None:
                continue
            decay = math_exp_decay(step, half_life=16.0)
            pred_aqi = max(5, min(500, int(round(float(raw_pred) + station_offset * decay))))

            # Uncertainty widens realistically with forecast lead time & recent volatility
            half_width = max(6, int(round(mean_step_vol * (1.0 + step / 18.0) + step * 0.45)))
            conf = max(52, min(94, int(round(92 - step * 0.65 - min(12.0, mean_step_vol * 0.4)))))
            unc_label = (
                "Low Uncertainty" if conf >= 80 else "Moderate Uncertainty" if conf >= 68 else "Higher Uncertainty"
            )

            hour_of_day = int(times[i][11:13]) if len(times[i]) >= 13 else 12
            drivers = self._derive_drivers(hour_of_day, pred_aqi, wind_kmh)

            forecasts.append(
                ForecastPointSchema(
                    timestamp=times[i],
                    predicted_aqi=pred_aqi,
                    uncertainty_low=max(0, pred_aqi - half_width),
                    uncertainty_high=min(500, pred_aqi + half_width),
                    confidence_pct=conf,
                    uncertainty_label=unc_label,  # type: ignore[arg-type]
                    level=aqi_sources.aqi_to_level(pred_aqi),
                    pm25=aqi_sources._safe_float(pm25_arr[i]) if i < len(pm25_arr) else None,
                    pm10=aqi_sources._safe_float(pm10_arr[i]) if i < len(pm10_arr) else None,
                    o3=aqi_sources._safe_float(o3_arr[i]) if i < len(o3_arr) else None,
                    drivers=drivers,
                )
            )

        # Trend direction
        if len(forecasts) >= 6:
            early = sum(f.predicted_aqi for f in forecasts[:6]) / 6.0
            late = sum(f.predicted_aqi for f in forecasts[-6:]) / 6.0
            diff = late - early
            if diff <= -10:
                trend = "improving"
            elif diff >= 10:
                trend = "worsening"
            elif max(f.predicted_aqi for f in forecasts) - min(f.predicted_aqi for f in forecasts) > 35:
                trend = "variable"
            else:
                trend = "stable"
        else:
            trend = "stable"

        unhealthy_windows = self._detect_unhealthy_windows(forecasts)
        preventive = self._build_preventive_actions(forecasts, unhealthy_windows, trend)
        citations = rag_engine.retrieve(f"AQI forecast trend {trend} dispersion unhealthy window early warning", top_k=3)

        # IBM Granite reasoning
        peak_pt = max(forecasts, key=lambda x: x.predicted_aqi) if forecasts else None
        low_pt = min(forecasts, key=lambda x: x.predicted_aqi) if forecasts else None
        system_prompt = (
            "You are the AirGuard Forecasting Specialist Agent. Summarize the air quality forecast objectively, "
            "explicitly mentioning forecast uncertainty/confidence and avoiding deterministic guarantees."
        )
        user_prompt = (
            f"City: {live.location.city}\n"
            f"Current AQI: {live.aqi} ({live.level})\n"
            f"Wind Speed: {wind_kmh} km/h\n"
            f"48h Trend: {trend}\n"
            f"Projected Peak: {peak_pt.predicted_aqi if peak_pt else 'N/A'} around {peak_pt.timestamp if peak_pt else 'N/A'} "
            f"(range {peak_pt.uncertainty_low}-{peak_pt.uncertainty_high})\n"
            f"Projected Best Window: {low_pt.predicted_aqi if low_pt else 'N/A'} around {low_pt.timestamp if low_pt else 'N/A'}\n"
            "Write 2-3 concise sentences explaining drivers, uncertainty, and best/worst timing."
        )
        granite_text, _ = granite_service.chat(system_prompt=system_prompt, user_prompt=user_prompt, max_tokens=200)

        if granite_text:
            reasoning_mode: ReasoningMode = "ibm_watsonx_granite"
            reasoning = granite_text
        else:
            reasoning_mode = "deterministic_evidence_synthesis"
            reasoning = (
                f"Over the next {len(forecasts)} hours in {live.location.city}, modelled AQI shows a {trend} pattern. "
                + (
                    f"Highest projected pollution is ~{peak_pt.predicted_aqi} (uncertainty band {peak_pt.uncertainty_low}–{peak_pt.uncertainty_high}, "
                    f"{peak_pt.confidence_pct}% confidence) near {peak_pt.timestamp[11:16]}, while cleaner conditions (~{low_pt.predicted_aqi}) "
                    f"appear near {low_pt.timestamp[11:16]}. "
                    if peak_pt and low_pt
                    else ""
                )
                + f"Surface wind ({wind_kmh:.1f} km/h) and boundary-layer dispersion remain key uncertainty drivers."
            )

        return ForecastResponse(
            location=live.location.city,
            source_name="Open-Meteo CAMS Atmospheric Forecast + Station Bias Calibration",
            generated_at=datetime.now(timezone.utc).isoformat(),
            horizon_hours=len(forecasts),
            trend_direction=trend,  # type: ignore[arg-type]
            confidence_note=(
                "Forecast values represent probabilistic CAMS atmospheric dispersion estimates calibrated to local telemetry; "
                "confidence declines with lead time and sudden weather or emission shifts."
            ),
            forecasts=forecasts,
            unhealthy_windows=unhealthy_windows,
            preventive_recommendations=preventive,
            reasoning_mode=reasoning_mode,
            granite_reasoning=reasoning,
            citations=citations,
        )

    @staticmethod
    def _derive_drivers(hour: int, aqi: int, wind_kmh: float) -> List[str]:
        drivers: List[str] = []
        if 7 <= hour <= 10:
            drivers.append("Morning commuter emissions")
        if 18 <= hour <= 22:
            drivers.append("Evening traffic & boundary-layer inversion")
        if 12 <= hour <= 16:
            drivers.append("Midday photochemical ozone mixing")
        if wind_kmh < 7.0:
            drivers.append("Low wind dispersion")
        elif wind_kmh >= 16.0:
            drivers.append("Favorable wind dilution")
        if aqi > 150 and "Low wind dispersion" not in drivers:
            drivers.append("Elevated regional particulate load")
        return drivers or ["Standard diurnal atmospheric cycle"]

    @staticmethod
    def _detect_unhealthy_windows(forecasts: List[ForecastPointSchema]) -> List[UnhealthyWindow]:
        windows: List[UnhealthyWindow] = []
        active: List[ForecastPointSchema] = []

        def flush():
            if not active:
                return
            peak = max(active, key=lambda x: x.predicted_aqi)
            sev = "critical" if peak.predicted_aqi > 200 else "warning"
            windows.append(
                UnhealthyWindow(
                    start_time=active[0].timestamp,
                    end_time=active[-1].timestamp,
                    peak_aqi=peak.predicted_aqi,
                    level=peak.level,
                    severity=sev,  # type: ignore[arg-type]
                    summary=(
                        f"Projected {peak.level} period peaking around AQI {peak.predicted_aqi} "
                        f"(uncertainty {peak.uncertainty_low}–{peak.uncertainty_high})."
                    ),
                    preventive_action=(
                        "Shift outdoor workouts outside this window, keep windows closed, and prepare N95 protection."
                    ),
                )
            )
            active.clear()

        for pt in forecasts:
            if pt.predicted_aqi >= 101:
                active.append(pt)
            else:
                flush()
        flush()
        return windows[:5]

    @staticmethod
    def _build_preventive_actions(
        forecasts: List[ForecastPointSchema],
        windows: List[UnhealthyWindow],
        trend: str,
    ) -> List[str]:
        actions: List[str] = []
        if forecasts:
            best = min(forecasts[:24], key=lambda x: x.predicted_aqi)
            actions.append(
                f"Best upcoming 24h window for errands or ventilation: around {best.timestamp[11:16]} (projected AQI ~{best.predicted_aqi})."
            )
        if windows:
            actions.append(
                f"Plan indoor routines during {windows[0].start_time[11:16]}–{windows[0].end_time[11:16]} when AQI may peak near {windows[0].peak_aqi}."
            )
        if trend == "worsening":
            actions.append("Pre-check HEPA filter status and keep N95 masks accessible before pollution builds.")
        else:
            actions.append("Re-verify live station readings before vigorous outdoor exercise, as wind shifts can alter trajectories.")
        return actions


def math_exp_decay(step: int, half_life: float) -> float:
    import math

    return math.exp(-step / max(1.0, half_life))


forecasting_agent = ForecastingAgent()
