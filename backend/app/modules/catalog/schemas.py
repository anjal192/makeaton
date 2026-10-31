"""Pydantic v2 request/response schemas. These rules are the source of truth;
mirror them in the frontend Zod schemas.

Note: Decimal values are sent as JSON strings (e.g. "19.99") so no precision is lost.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from .models import BillingPeriod, DiscountType

T = TypeVar("T")

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Sku = Annotated[
    str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=64)
]
Code = Annotated[
    str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=50)
]
Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
Percent = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]
Qty = Annotated[int, Field(ge=1, le=1_000_000)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int


# ---------- Products ----------
class ProductCreate(BaseModel):
    name: Name
    sku: Sku
    description: Optional[str] = Field(default=None, max_length=5000)
    base_price: Money
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: Optional[Name] = None
    sku: Optional[Sku] = None
    description: Optional[str] = Field(default=None, max_length=5000)
    base_price: Optional[Money] = None
    is_active: Optional[bool] = None


class ProductOut(ORMModel):
    id: int
    name: str
    sku: str
    description: Optional[str]
    base_price: Decimal
    is_active: bool
    created_at: datetime


# ---------- Variants ----------
class VariantCreate(BaseModel):
    name: Name
    sku: Sku
    extra_price: Money = Decimal("0")
    is_active: bool = True


class VariantUpdate(BaseModel):
    name: Optional[Name] = None
    sku: Optional[Sku] = None
    extra_price: Optional[Money] = None
    is_active: Optional[bool] = None


class VariantOut(ORMModel):
    id: int
    product_id: int
    name: str
    sku: str
    extra_price: Decimal
    is_active: bool


# ---------- Plans ----------
class PlanCreate(BaseModel):
    name: Name
    description: Optional[str] = Field(default=None, max_length=5000)
    billing_period: BillingPeriod
    price: Money
    min_quantity: Qty = 1
    max_quantity: Optional[Qty] = None
    duration_cycles: Optional[Qty] = None
    is_active: bool = True

    @model_validator(mode="after")
    def _check_quantities(self):
        if self.max_quantity is not None and self.max_quantity < self.min_quantity:
            raise ValueError("max_quantity must be >= min_quantity")
        return self


class PlanUpdate(BaseModel):
    name: Optional[Name] = None
    description: Optional[str] = Field(default=None, max_length=5000)
    billing_period: Optional[BillingPeriod] = None
    price: Optional[Money] = None
    min_quantity: Optional[Qty] = None
    max_quantity: Optional[Qty] = None
    duration_cycles: Optional[Qty] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def _check_quantities(self):
        if (
            self.min_quantity is not None
            and self.max_quantity is not None
            and self.max_quantity < self.min_quantity
        ):
            raise ValueError("max_quantity must be >= min_quantity")
        return self


class PlanOut(ORMModel):
    id: int
    name: str
    description: Optional[str]
    billing_period: BillingPeriod
    price: Decimal
    min_quantity: int
    max_quantity: Optional[int]
    duration_cycles: Optional[int]
    is_active: bool


# ---------- Taxes ----------
class TaxCreate(BaseModel):
    name: Name
    rate_percent: Percent
    is_active: bool = True


class TaxUpdate(BaseModel):
    name: Optional[Name] = None
    rate_percent: Optional[Percent] = None
    is_active: Optional[bool] = None


class TaxOut(ORMModel):
    id: int
    name: str
    rate_percent: Decimal
    is_active: bool


# ---------- Discounts ----------
class DiscountCreate(BaseModel):
    name: Name
    code: Optional[Code] = None
    discount_type: DiscountType
    value: PositiveMoney
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    min_amount: Optional[Money] = None
    min_quantity: Optional[Qty] = None
    usage_limit: Optional[Qty] = None
    is_active: bool = True

    @model_validator(mode="after")
    def _check_rules(self):
        if self.discount_type == DiscountType.percent and self.value > 100:
            raise ValueError("a percent discount cannot be more than 100")
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class DiscountUpdate(BaseModel):
    name: Optional[Name] = None
    code: Optional[Code] = None
    discount_type: Optional[DiscountType] = None
    value: Optional[PositiveMoney] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    min_amount: Optional[Money] = None
    min_quantity: Optional[Qty] = None
    usage_limit: Optional[Qty] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def _check_rules(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class DiscountOut(ORMModel):
    id: int
    name: str
    code: Optional[str]
    discount_type: DiscountType
    value: Decimal
    start_date: Optional[date]
    end_date: Optional[date]
    min_amount: Optional[Decimal]
    min_quantity: Optional[int]
    usage_limit: Optional[int]
    used_count: int
    is_active: bool


# ---------- Quotation templates ----------
class TemplateLineIn(BaseModel):
    product_id: int
    quantity: Qty = 1
    unit_price: Optional[Money] = None


class TemplateLineOut(ORMModel):
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    created_at: Optional[datetime] = None


class TemplateCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=150)]
    plan_id: int
    validity_days: Annotated[int, Field(ge=1, le=3650)] = 30
    lines: list[TemplateLineIn] = Field(min_length=1)


class TemplateUpdate(BaseModel):
    name: Optional[Annotated[str, Field(min_length=1, max_length=150)]] = None
    plan_id: Optional[int] = None
    validity_days: Optional[Annotated[int, Field(ge=1, le=3650)]] = None
    # If given, replaces ALL existing lines.
    lines: Optional[list[TemplateLineIn]] = Field(default=None, min_length=1)


class TemplateOut(ORMModel):
    id: int
    name: str
    plan_id: int
    validity_days: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    lines: list[TemplateLineOut]
