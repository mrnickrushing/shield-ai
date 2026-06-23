"""Approximate reference prices for common medical codes.

These are rounded, **approximate national Medicare payment amounts** for some of
the most frequently billed CPT/HCPCS codes. They exist only to answer one
question for a patient: "is this charge wildly above what the service typically
costs?" — the way tools like hospital price-transparency files and Healthcare
Bluebook frame it.

Important honesty caveats (surfaced to the user, never hidden):
  * Real allowed amounts vary by year, region, setting, and payer.
  * Providers legitimately charge above Medicare; a high multiple is a *question
    to ask*, not proof of an error.
  * This is a small curated subset, not a complete fee schedule.

Because of that imprecision we only flag charges at a high multiple of the
reference (see OVER_REFERENCE_MULTIPLE in medbill.py), so a rough reference can't
produce a false alarm.
"""
from __future__ import annotations

REFERENCE_NOTE = (
    "Reference prices are approximate national Medicare amounts for guidance only; "
    "actual rates vary by region, year, and setting."
)

# code -> approximate Medicare national amount (USD), rounded.
REFERENCE_PRICES: dict[str, float] = {
    # Office / outpatient E&M — established patient
    "99211": 23,
    "99212": 57,
    "99213": 92,
    "99214": 131,
    "99215": 184,
    # Office / outpatient E&M — new patient
    "99202": 73,
    "99203": 113,
    "99204": 169,
    "99205": 224,
    # Emergency department visits
    "99281": 23,
    "99282": 45,
    "99283": 79,
    "99284": 150,
    "99285": 220,
    # Common labs
    "80048": 9,    # basic metabolic panel
    "80053": 12,   # comprehensive metabolic panel
    "80061": 13,   # lipid panel
    "83036": 13,   # hemoglobin A1c
    "84443": 16,   # TSH
    "85025": 11,   # CBC with differential
    "81001": 4,    # urinalysis
    "87804": 16,   # influenza test
    # Imaging
    "71046": 30,   # chest x-ray, 2 views
    "73610": 28,   # x-ray ankle
    "93000": 16,   # EKG with interpretation
    "76700": 95,   # abdominal ultrasound, complete
    "70450": 120,  # CT head without contrast
    "72148": 240,  # MRI lumbar spine without contrast
    "74177": 330,  # CT abdomen & pelvis with contrast
    # Procedures / administration
    "90471": 25,   # immunization administration
    "96372": 25,   # therapeutic/diagnostic injection
    "36415": 3,    # routine venipuncture
    "99173": 3,    # visual acuity screen
}


def lookup(code: str) -> float | None:
    """Approximate reference price for a CPT/HCPCS code, or None if unknown."""
    return REFERENCE_PRICES.get(code.upper()) if code else None
