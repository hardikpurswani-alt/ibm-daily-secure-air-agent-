"""Specialist Agent B: Health Advisory Agent — Personalized guidance via IBM Granite & RAG."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from ..schemas.airguard import (
    HealthAdvisoryResponse,
    HealthProfileInput,
    LiveAQIResponse,
    ReasoningMode,
    RiskGroupAdvisory,
)
from ..services.granite_service import granite_service
from ..services.rag_service import rag_engine

MEDICAL_DISCLAIMER = (
    "AirGuard AI provides preventive environmental health guidance only. It does not diagnose medical "
    "conditions or replace individualized advice from a licensed physician or healthcare professional."
)


class HealthAdvisoryAgent:
    """Generates non-diagnostic, personalized daily precautions backed by WHO/EPA/CDC RAG & Granite."""

    async def generate(
        self,
        live: LiveAQIResponse,
        profile: HealthProfileInput,
    ) -> HealthAdvisoryResponse:
        aqi = live.aqi if live.aqi is not None else 50
        pm25 = next((p.value for p in live.pollutants if p.code == "PM2.5" and p.available), None)
        considerations = [c.strip().lower() for c in profile.health_considerations if c.strip()]

        # Compute personal vulnerability multiplier
        multiplier = 1.0
        if profile.age_group in ("child", "older_adult"):
            multiplier *= 1.3
        if profile.outdoor_activity in ("high", "outdoor_worker"):
            multiplier *= 1.25
        if considerations:
            multiplier *= 1.35

        effective_aqi = aqi * multiplier
        if effective_aqi > 300:
            personal_risk = "Critical"
        elif effective_aqi > 200:
            personal_risk = "Very High"
        elif effective_aqi > 140:
            personal_risk = "High"
        elif effective_aqi > 80:
            personal_risk = "Moderate"
        else:
            personal_risk = "Low"

        rag_query = (
            f"AQI {aqi} {live.level} PM2.5 {pm25 or ''} mask N95 HEPA indoor air "
            f"{profile.age_group} {profile.outdoor_activity} {' '.join(considerations)}"
        )
        citations = rag_engine.retrieve(rag_query, top_k=4)
        context_text = "\n".join(f"- [{c.title} - {c.section}]: {c.excerpt}" for c in citations)

        system_prompt = (
            "You are the AirGuard Health Advisory Specialist Agent. Provide clear, actionable daily precautions "
            "grounded strictly in the provided environmental guidelines. Consider the user's age group, outdoor "
            "activity level, and optional health considerations. NEVER diagnose medical conditions or prescribe "
            "treatments. Include mask and indoor-air guidance."
        )
        user_prompt = (
            f"City: {live.location.city}\n"
            f"AQI: {aqi} ({live.level}, {live.aqi_scale}), Dominant: {live.dominant_pollutant}, PM2.5: {pm25}\n"
            f"Profile: age_group={profile.age_group}, outdoor_activity={profile.outdoor_activity}, "
            f"considerations={considerations or ['none']}\n"
            f"Retrieved Evidence:\n{context_text}\n\n"
            "Return JSON with keys: headline_recommendation (string), daily_precautions (array of 4 short strings), "
            "outdoor_activity_guidance (string), mask_and_indoor_guidance (string), granite_analysis (string under 110 words)."
        )

        granite_json, _ = granite_service.structured_json(system_prompt=system_prompt, user_prompt=user_prompt)

        if granite_json:
            reasoning_mode: ReasoningMode = "ibm_watsonx_granite"
            headline = str(granite_json.get("headline_recommendation") or self._default_headline(personal_risk, live))
            precautions = [str(x) for x in granite_json.get("daily_precautions", [])][:5] or self._default_precautions(personal_risk)
            outdoor_guide = str(granite_json.get("outdoor_activity_guidance") or self._default_outdoor(personal_risk, profile))
            mask_guide = str(granite_json.get("mask_and_indoor_guidance") or self._default_mask_indoor(personal_risk))
            analysis = str(granite_json.get("granite_analysis") or headline)
        else:
            reasoning_mode = "deterministic_evidence_synthesis"
            headline = self._default_headline(personal_risk, live)
            precautions = self._default_precautions(personal_risk)
            outdoor_guide = self._default_outdoor(personal_risk, profile)
            mask_guide = self._default_mask_indoor(personal_risk)
            analysis = (
                f"Evidence synthesis from {citations[0].source_org if citations else 'WHO/EPA/CDC'} for "
                f"{live.location.city} (AQI {aqi}, {live.dominant_pollutant} dominant): {headline} "
                f"Personal sensitivity factor evaluates risk as {personal_risk} for "
                f"{profile.age_group.replace('_', ' ')} profile with {profile.outdoor_activity.replace('_', ' ')} outdoor exposure."
            )

        group_advisories = self._build_group_matrix(aqi)

        return HealthAdvisoryResponse(
            location=live.location.city,
            aqi=live.aqi,
            level=live.level,
            personalized_risk_level=personal_risk,  # type: ignore[arg-type]
            profile_used=profile,
            headline_recommendation=headline,
            daily_precautions=precautions,
            outdoor_activity_guidance=outdoor_guide,
            mask_and_indoor_guidance=mask_guide,
            group_advisories=group_advisories,
            reasoning_mode=reasoning_mode,
            granite_analysis=analysis,
            citations=citations,
            medical_disclaimer=MEDICAL_DISCLAIMER,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    @staticmethod
    def _default_headline(risk: str, live: LiveAQIResponse) -> str:
        mapping = {
            "Low": f"Air quality in {live.location.city} supports normal outdoor plans with routine awareness.",
            "Moderate": f"Moderate particulate or gas load in {live.location.city}; pace intense outdoor exertion.",
            "High": f"Elevated exposure risk in {live.location.city}; shift vigorous exercise indoors and protect airways.",
            "Very High": f"High-pollution alert in {live.location.city}; minimize outdoor duration and run indoor HEPA filtration.",
            "Critical": f"Severe air quality alert in {live.location.city}; stay indoors with sealed rooms and filtered air.",
        }
        return mapping.get(risk, mapping["Moderate"])

    @staticmethod
    def _default_precautions(risk: str) -> List[str]:
        if risk == "Low":
            return [
                "Enjoy outdoor activities while monitoring late-afternoon or rush-hour shifts.",
                "Ventilate indoor spaces naturally during clean-air windows.",
                "Keep prescribed reliever inhalers accessible if you have known airway sensitivity.",
                "Stay hydrated before and after outdoor exercise.",
            ]
        if risk == "Moderate":
            return [
                "Prefer morning/midday breaks away from major traffic corridors.",
                "Monitor mild throat or eye irritation during prolonged outdoor exertion.",
                "Keep windows closed along busy arterial roads during rush hour.",
                "Check evening forecast before scheduling long outdoor runs.",
            ]
        if risk == "High":
            return [
                "Move high-intensity cardio and outdoor workouts indoors.",
                "Wear a properly sealed N95/KN95/FFP2 mask for extended commutes.",
                "Run a True HEPA air cleaner in main living/sleeping rooms.",
                "Keep windows shut and avoid candles, incense, or unvented cooking smoke.",
            ]
        return [
            "Avoid non-essential outdoor exposure, especially for children, older adults, and sensitive groups.",
            "Wear a well-fitted NIOSH N95 or FFP2 respirator whenever stepping outside.",
            "Set home and vehicle HVAC to recirculate mode and run HEPA filtration continuously.",
            "Keep rescue/prescribed medications close and seek clinician care if breathing worsens.",
        ]

    @staticmethod
    def _default_outdoor(risk: str, profile: HealthProfileInput) -> str:
        if risk == "Low":
            return f"Normal duration appropriate for {profile.outdoor_activity.replace('_', ' ')} routines."
        if risk == "Moderate":
            return "Reduce continuous vigorous outdoor exertion by 25–30%; insert shaded rest breaks away from traffic."
        if risk == "High":
            return "Replace outdoor runs or heavy outdoor labor with indoor alternatives; limit unavoidable errands."
        return "Cancel outdoor exercise and reschedule non-essential outdoor work until AQI drops below 150."

    @staticmethod
    def _default_mask_indoor(risk: str) -> str:
        if risk == "Low":
            return "No mask needed outdoors; standard indoor cross-ventilation is beneficial."
        if risk == "Moderate":
            return "Sensitive individuals may carry an N95/KN95 for congested streets; ventilate away from peak traffic."
        return "Use a snug N95/FFP2 respirator outdoors (cloth/surgical masks do not filter PM2.5); seal windows and run True HEPA air filtration indoors."

    @staticmethod
    def _build_group_matrix(aqi: int) -> List[RiskGroupAdvisory]:
        groups = [
            ("General Public", 1.0),
            ("Children & Students", 1.4),
            ("Older Adults (65+)", 1.45),
            ("Respiratory Sensitivity (Asthma/COPD)", 1.8),
            ("Cardiovascular Sensitivity", 1.75),
            ("Outdoor Athletes & Workers", 1.35),
        ]
        out: List[RiskGroupAdvisory] = []
        for label, mult in groups:
            eff = aqi * mult
            if eff > 300:
                rl = "Critical"
                summary = "Avoid outdoor exposure completely; maintain a filtered clean-air room indoors."
                avoid = ["All outdoor exertion", "Natural window ventilation", "Indoor smoke/incense"]
                mask = "Mandatory fitted N95/FFP2 if brief essential transit occurs"
            elif eff > 200:
                rl = "Very High"
                summary = "Stay indoors with filtered air; avoid prolonged exposure."
                avoid = ["Outdoor sports", "Roadside walking", "Unfiltered indoor spaces"]
                mask = "Fitted N95/FFP2 recommended for any outdoor trip"
            elif eff > 130:
                rl = "High"
                summary = "Significantly shorten outdoor time and move strenuous activity indoors."
                avoid = ["High-intensity outdoor cardio", "Peak rush-hour commutes"]
                mask = "Wear N95/KN95 when outdoors > 20 minutes"
            elif eff > 75:
                rl = "Moderate"
                summary = "Reduce prolonged heavy outdoor exertion if irritation occurs."
                avoid = ["Extended roadside exertion"]
                mask = "Optional N95 near traffic hotspots"
            else:
                rl = "Low"
                summary = "Safe for normal daily routines and outdoor exercise."
                avoid = []
                mask = "Not required"

            out.append(
                RiskGroupAdvisory(
                    risk_group=label,
                    risk_level=rl,  # type: ignore[arg-type]
                    summary=summary,
                    precautions=[
                        "Monitor hourly forecast dips for safer travel windows",
                        "Keep indoor particulate sources (smoke, sprays) minimal",
                    ],
                    outdoor_adjustment=summary,
                    mask_guidance=mask,
                    indoor_air_guidance="Use True HEPA filtration when AQI > 100; recirculate HVAC.",
                    avoid_activities=avoid,
                )
            )
        return out


health_advisory_agent = HealthAdvisoryAgent()
