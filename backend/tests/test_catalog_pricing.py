"""Tests for the pure pricing logic. Run: pytest tests/test_catalog_pricing.py -q"""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.modules.catalog.pricing import price_line

TODAY = date(2026, 10, 31)


def make_discount(**overrides):
    base = dict(
        is_active=True,
        discount_type="percent",
        value=Decimal("10"),
        start_date=None,
        end_date=None,
        min_amount=None,
        min_quantity=None,
        usage_limit=None,
        used_count=0,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_plain_line_no_tax_no_discount():
    r = price_line(Decimal("100.00"), 2, today=TODAY)
    assert r.subtotal == Decimal("200.00")
    assert r.discount_amount == Decimal("0.00")
    assert r.tax_amount == Decimal("0.00")
    assert r.total == Decimal("200.00")


def test_percent_discount_then_tax_on_discounted_amount():
    r = price_line(Decimal("100.00"), 1, tax_rate_percent=18, discount=make_discount(), today=TODAY)
    assert r.discount_amount == Decimal("10.00")
    assert r.tax_amount == Decimal("16.20")  # 18% of 90.00
    assert r.total == Decimal("106.20")
    assert r.discount_applied is True


def test_fixed_discount_is_capped_at_subtotal():
    d = make_discount(discount_type="fixed", value=Decimal("500"))
    r = price_line(Decimal("20.00"), 1, discount=d, today=TODAY)
    assert r.discount_amount == Decimal("20.00")
    assert r.total == Decimal("0.00")


def test_rounding_happens_once_per_amount():
    # 19.99 * 3 = 59.97; 15% = 8.9955 -> 9.00; tax 18% of 50.97 = 9.1746 -> 9.17
    r = price_line(Decimal("19.99"), 3, tax_rate_percent=Decimal("18"), discount=make_discount(value=Decimal("15")), today=TODAY)
    assert r.subtotal == Decimal("59.97")
    assert r.discount_amount == Decimal("9.00")
    assert r.tax_amount == Decimal("9.17")
    assert r.total == Decimal("60.14")
    assert r.subtotal - r.discount_amount + r.tax_amount == r.total


def test_zero_tax_rate():
    r = price_line(Decimal("10.00"), 1, tax_rate_percent=0, today=TODAY)
    assert r.tax_amount == Decimal("0.00")
    assert r.total == Decimal("10.00")


@pytest.mark.parametrize(
    "overrides, reason",
    [
        (dict(is_active=False), "inactive"),
        (dict(start_date=date(2026, 11, 1)), "not started"),
        (dict(end_date=date(2026, 10, 30)), "expired"),
        (dict(min_amount=Decimal("500")), "minimum amount"),
        (dict(min_quantity=5), "minimum quantity"),
        (dict(usage_limit=3, used_count=3), "usage limit"),
    ],
)
def test_discount_not_applied(overrides, reason):
    r = price_line(Decimal("100.00"), 1, discount=make_discount(**overrides), today=TODAY)
    assert r.discount_applied is False
    assert r.discount_amount == Decimal("0.00")
    assert reason in r.discount_reason
    assert r.total == Decimal("100.00")


def test_discount_on_boundary_dates_is_applied():
    d = make_discount(start_date=TODAY, end_date=TODAY)
    assert price_line(Decimal("100"), 1, discount=d, today=TODAY).discount_applied is True


def test_last_available_use_is_applied():
    d = make_discount(usage_limit=3, used_count=2)
    assert price_line(Decimal("100"), 1, discount=d, today=TODAY).discount_applied is True


def test_invalid_inputs_raise():
    with pytest.raises(ValueError):
        price_line(Decimal("10"), 0)
    with pytest.raises(ValueError):
        price_line(Decimal("-1"), 1)
