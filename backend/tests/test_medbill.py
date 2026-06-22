"""MedBill Shield analyzer — structured parsing + per-line verdict tests."""
from app.verticals import medbill


def test_parses_line_items_with_code_and_amount():
    items, _ = medbill._parse("Office visit 99213 $250.00\nCBC panel 85025 $80.00")
    assert len(items) == 2
    assert items[0].code == "99213"
    assert items[0].amount == 250.0
    assert "office visit" in items[0].description.lower()
    assert items[1].code == "85025"


def test_total_line_is_not_a_charge_line():
    items, _ = medbill._parse("Office visit $250.00\nTotal due $250.00")
    # The "Total due" summary line must not be counted as a charge.
    assert len(items) == 1
    assert items[0].amount == 250.0


def test_duplicate_by_code_flagged_and_overcharge_estimated():
    res = medbill.analyze("Office visit 99213 $250.00\nLab $80.00\nOffice visit 99213 $250.00", {})
    assert res.category == "duplicate_charge"
    assert res.score >= 30
    assert res.evidence["estimated_overcharge"] == 250.0
    statuses = [li["status"] for li in res.evidence["line_items"]]
    assert statuses.count("duplicate") == 1
    assert "$250.00" in res.output_artifact


def test_math_error_only_when_items_exceed_stated_total():
    over = medbill.analyze("Office visit $300.00\nLab $300.00\nTotal due $400.00", {})
    assert any("stated total" in f.lower() for f in over.flags)

    # A normal itemized bill whose lines match the total is NOT a math error.
    ok = medbill.analyze("Office visit $300.00\nLab $100.00\nTotal due $400.00", {})
    assert not any("stated total" in f.lower() for f in ok.flags)


def test_out_of_network_flagged():
    res = medbill.analyze("Surgery 12345 $5,000.00\nThis provider is out-of-network", {})
    assert res.category in ("balance_billing", "duplicate_charge", "math_error")
    assert any("out-of-network" in f.lower() for f in res.flags)


def test_clean_bill_has_low_score_and_no_error_flags():
    res = medbill.analyze("Office visit 99213 $150.00\nTotal due $150.00", {})
    assert res.score == 0
    assert not any("duplicate" in f.lower() for f in res.flags)
    assert res.evidence["estimated_overcharge"] == 0.0


def test_charge_line_containing_total_is_not_dropped():
    # "Total knee replacement" is a service, not a summary row — keep it.
    items, totals = medbill._parse("Total knee replacement 27447 $15,000.00")
    assert len(items) == 1
    assert items[0].code == "27447"
    assert items[0].amount == 15000.0
    assert totals == []

    # A genuine summary row (no procedure code) is still treated as a total.
    items2, totals2 = medbill._parse("Office visit $150.00\nTotal $150.00")
    assert len(items2) == 1
    assert totals2 == [150.0]


def test_dispute_letter_includes_out_of_network_concern():
    res = medbill.analyze("Surgery 12345 $5,000.00\nThis provider is out-of-network", {})
    # No line item is a duplicate, but the OON concern must still be in the letter.
    assert "out-of-network" in res.output_artifact.lower()


def test_dispute_letter_includes_math_error_concern():
    res = medbill.analyze("Office visit $300.00\nLab $300.00\nTotal due $400.00", {})
    assert "stated total" in res.output_artifact.lower()
