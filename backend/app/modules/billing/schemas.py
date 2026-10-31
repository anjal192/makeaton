from datetime import date, datetime
from decimal import Decimal
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, model_validator

T = TypeVar("T")
Money = Decimal


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


# ---------- Subscriptions ----------
class SubscriptionLineCreate(BaseModel):
    product_id: int
    variant_id: int | None = None
    tax_id: int | None = None
    quantity: int = Field(default=1, ge=1)
    unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class SubscriptionLineRead(SubscriptionLineCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


class SubscriptionCreate(BaseModel):
    customer_id: int | None = None  # ignored for customers; taken from the logged-in user
    plan_id: int
    template_id: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    lines: list[SubscriptionLineCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def check_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class SubscriptionStatusUpdate(BaseModel):
    status: Literal["draft", "quotation", "confirmed", "active", "closed"]


class SubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    plan_id: int
    template_id: int | None
    status: str
    start_date: date | None
    end_date: date | None
    next_billing_date: date | None
    created_at: datetime
    lines: list[SubscriptionLineRead] = []


# ---------- Quotation templates ----------
class QuotationTemplateLineCreate(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1)
    unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class QuotationTemplateLineRead(QuotationTemplateLineCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


class QuotationTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    plan_id: int
    validity_days: int = Field(default=30, ge=1)
    lines: list[QuotationTemplateLineCreate] = Field(min_length=1)


class QuotationTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    plan_id: int
    validity_days: int
    lines: list[QuotationTemplateLineRead] = []


# ---------- Invoices and payments ----------
class InvoiceLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    description: str
    quantity: int
    unit_price: Decimal
    tax_amount: Decimal
    line_total: Decimal


class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    method: Literal["cash", "card", "bank_transfer", "upi"]


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_id: int
    amount: Decimal
    method: str
    paid_at: datetime


class InvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    subscription_id: int
    customer_id: int
    status: str
    period_start: date
    period_end: date
    due_date: date
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal
    created_at: datetime
    lines: list[InvoiceLineRead] = []
    payments: list[PaymentRead] = []
