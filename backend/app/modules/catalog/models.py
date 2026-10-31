"""Catalog tables: products, variants, plans, taxes, discounts, quotation templates.

Money is NUMERIC(12,2), percentages NUMERIC(5,2). Never floats.
"""
import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .deps import Base

MONEY = Numeric(12, 2)
PERCENT = Numeric(5, 2)


class BillingPeriod(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"


class DiscountType(str, enum.Enum):
    percent = "percent"
    fixed = "fixed"


def _enum(py_enum):
    # Stored as plain VARCHAR holding the value ('monthly'), so Alembic stays simple.
    return Enum(
        py_enum,
        native_enum=False,
        length=20,
        values_callable=lambda e: [m.value for m in e],
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (CheckConstraint("base_price >= 0", name="ck_products_base_price"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    sku: Mapped[str] = mapped_column(String(64), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    base_price: Mapped[Decimal] = mapped_column(MONEY)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )


class ProductVariant(TimestampMixin, Base):
    __tablename__ = "product_variants"
    __table_args__ = (
        UniqueConstraint("product_id", "name", name="uq_variant_product_name"),
        CheckConstraint("extra_price >= 0", name="ck_variants_extra_price"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))  # e.g. "Large / Red"
    sku: Mapped[str] = mapped_column(String(64), unique=True)
    extra_price: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0"), server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    product: Mapped[Product] = relationship(back_populates="variants")


class Plan(TimestampMixin, Base):
    __tablename__ = "plans"
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_plans_price"),
        CheckConstraint("min_quantity >= 1", name="ck_plans_min_qty"),
        CheckConstraint(
            "max_quantity IS NULL OR max_quantity >= min_quantity", name="ck_plans_max_qty"
        ),
        CheckConstraint(
            "duration_cycles IS NULL OR duration_cycles >= 1", name="ck_plans_duration"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    billing_period: Mapped[BillingPeriod] = mapped_column(_enum(BillingPeriod))
    price: Mapped[Decimal] = mapped_column(MONEY)
    min_quantity: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    max_quantity: Mapped[Optional[int]] = mapped_column(Integer)
    # Number of billing cycles before the plan auto-closes (NULL = never).
    duration_cycles: Mapped[Optional[int]] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class Tax(TimestampMixin, Base):
    __tablename__ = "taxes"
    __table_args__ = (
        CheckConstraint("rate_percent >= 0 AND rate_percent <= 100", name="ck_taxes_rate"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    rate_percent: Mapped[Decimal] = mapped_column(PERCENT)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class Discount(TimestampMixin, Base):
    __tablename__ = "discounts"
    __table_args__ = (
        CheckConstraint("value > 0", name="ck_discounts_value"),
        CheckConstraint(
            "discount_type <> 'percent' OR value <= 100", name="ck_discounts_percent_max"
        ),
        CheckConstraint(
            "start_date IS NULL OR end_date IS NULL OR end_date >= start_date",
            name="ck_discounts_dates",
        ),
        CheckConstraint("min_amount IS NULL OR min_amount >= 0", name="ck_discounts_min_amount"),
        CheckConstraint("min_quantity IS NULL OR min_quantity >= 1", name="ck_discounts_min_qty"),
        CheckConstraint("usage_limit IS NULL OR usage_limit >= 1", name="ck_discounts_limit"),
        CheckConstraint("used_count >= 0", name="ck_discounts_used_nonneg"),
        # Safety net: the database itself refuses to go over the limit.
        CheckConstraint(
            "usage_limit IS NULL OR used_count <= usage_limit", name="ck_discounts_used_max"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    code: Mapped[Optional[str]] = mapped_column(String(50), unique=True)
    discount_type: Mapped[DiscountType] = mapped_column(_enum(DiscountType))
    value: Mapped[Decimal] = mapped_column(MONEY)  # percent (0-100) or fixed amount
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    min_amount: Mapped[Optional[Decimal]] = mapped_column(MONEY)
    min_quantity: Mapped[Optional[int]] = mapped_column(Integer)
    usage_limit: Mapped[Optional[int]] = mapped_column(Integer)
    used_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


from app.modules.billing.models import QuotationTemplate, QuotationTemplateLine  # noqa: F401

