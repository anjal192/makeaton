"""Catalog endpoints. Register in app/main.py:

    from app.modules.catalog.router import router as catalog_router
    app.include_router(catalog_router)

Permissions:
  - products, variants, plans, quotation templates: admin + staff can write, anyone logged in can read
  - taxes, discounts: admin only to write, admin + staff to read (per the roadmap)
  - DELETE never removes rows; it deactivates them (old subscriptions still point at them)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from . import schemas, service
from .deps import admin_only, any_user, get_db, staff_or_admin
from .models import (
    BillingPeriod,
    Discount,
    Plan,
    Product,
    ProductVariant,
    QuotationTemplate,
    QuotationTemplateLine,
    Tax,
)

router = APIRouter(prefix="/catalog", tags=["catalog"])


# ---------- helpers ----------
def get_or_404(db: Session, model, obj_id: int, label: str):
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label} not found")
    return obj


def save(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        name = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
        detail = "Duplicate value or a rule was violated"
        raise HTTPException(status.HTTP_409_CONFLICT, f"{detail} ({name})" if name else detail)


def create_obj(db: Session, model, payload, **extra):
    obj = model(**payload.model_dump(), **extra)
    db.add(obj)
    save(db)
    db.refresh(obj)
    return obj


def update_obj(db: Session, obj, payload, skip=()):
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key in skip:
            continue
        if value is None and not obj.__table__.c[key].nullable:
            continue  # ignore an explicit null on a required column
        setattr(obj, key, value)
    save(db)
    db.refresh(obj)
    return obj


def deactivate(db: Session, obj) -> Response:
    obj.is_active = False
    save(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def page_params(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    return page, size


# ---------- products ----------
@router.post("/products", response_model=schemas.ProductOut, status_code=201)
def create_product(payload: schemas.ProductCreate, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    return create_obj(db, Product, payload)


@router.get("/products", response_model=schemas.Page[schemas.ProductOut])
def list_products(
    search: str | None = None,
    is_active: bool | None = None,
    pg=Depends(page_params),
    db: Session = Depends(get_db),
    _=Depends(any_user),
):
    stmt = select(Product).order_by(Product.id.desc())
    if search:
        like = f"%{search}%"
        stmt = stmt.where(Product.name.ilike(like) | Product.sku.ilike(like))
    if is_active is not None:
        stmt = stmt.where(Product.is_active == is_active)
    return service.paginate(db, stmt, *pg)


@router.get("/products/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db), _=Depends(any_user)):
    return get_or_404(db, Product, product_id, "Product")


@router.patch("/products/{product_id}", response_model=schemas.ProductOut)
def update_product(product_id: int, payload: schemas.ProductUpdate, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    return update_obj(db, get_or_404(db, Product, product_id, "Product"), payload)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    return deactivate(db, get_or_404(db, Product, product_id, "Product"))


# ---------- variants ----------
@router.post("/products/{product_id}/variants", response_model=schemas.VariantOut, status_code=201)
def create_variant(product_id: int, payload: schemas.VariantCreate, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    get_or_404(db, Product, product_id, "Product")
    return create_obj(db, ProductVariant, payload, product_id=product_id)


@router.get("/products/{product_id}/variants", response_model=list[schemas.VariantOut])
def list_variants(product_id: int, db: Session = Depends(get_db), _=Depends(any_user)):
    get_or_404(db, Product, product_id, "Product")
    stmt = select(ProductVariant).where(ProductVariant.product_id == product_id).order_by(ProductVariant.id)
    return db.scalars(stmt).all()


@router.patch("/variants/{variant_id}", response_model=schemas.VariantOut)
def update_variant(variant_id: int, payload: schemas.VariantUpdate, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    return update_obj(db, get_or_404(db, ProductVariant, variant_id, "Variant"), payload)


@router.delete("/variants/{variant_id}", status_code=204)
def delete_variant(variant_id: int, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    return deactivate(db, get_or_404(db, ProductVariant, variant_id, "Variant"))


# ---------- plans ----------
@router.post("/plans", response_model=schemas.PlanOut, status_code=201)
def create_plan(payload: schemas.PlanCreate, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    return create_obj(db, Plan, payload)


@router.get("/plans", response_model=schemas.Page[schemas.PlanOut])
def list_plans(
    search: str | None = None,
    is_active: bool | None = None,
    billing_period: BillingPeriod | None = None,
    pg=Depends(page_params),
    db: Session = Depends(get_db),
    _=Depends(any_user),
):
    stmt = select(Plan).order_by(Plan.id.desc())
    if search:
        stmt = stmt.where(Plan.name.ilike(f"%{search}%"))
    if is_active is not None:
        stmt = stmt.where(Plan.is_active == is_active)
    if billing_period is not None:
        stmt = stmt.where(Plan.billing_period == billing_period)
    return service.paginate(db, stmt, *pg)


@router.get("/plans/{plan_id}", response_model=schemas.PlanOut)
def get_plan(plan_id: int, db: Session = Depends(get_db), _=Depends(any_user)):
    return get_or_404(db, Plan, plan_id, "Plan")


@router.patch("/plans/{plan_id}", response_model=schemas.PlanOut)
def update_plan(plan_id: int, payload: schemas.PlanUpdate, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    return update_obj(db, get_or_404(db, Plan, plan_id, "Plan"), payload)


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: int, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    return deactivate(db, get_or_404(db, Plan, plan_id, "Plan"))


# ---------- taxes (admin only to write) ----------
@router.post("/taxes", response_model=schemas.TaxOut, status_code=201)
def create_tax(payload: schemas.TaxCreate, db: Session = Depends(get_db), _=Depends(admin_only)):
    return create_obj(db, Tax, payload)


@router.get("/taxes", response_model=schemas.Page[schemas.TaxOut])
def list_taxes(
    is_active: bool | None = None,
    pg=Depends(page_params),
    db: Session = Depends(get_db),
    _=Depends(staff_or_admin),
):
    stmt = select(Tax).order_by(Tax.id.desc())
    if is_active is not None:
        stmt = stmt.where(Tax.is_active == is_active)
    return service.paginate(db, stmt, *pg)


@router.patch("/taxes/{tax_id}", response_model=schemas.TaxOut)
def update_tax(tax_id: int, payload: schemas.TaxUpdate, db: Session = Depends(get_db), _=Depends(admin_only)):
    return update_obj(db, get_or_404(db, Tax, tax_id, "Tax"), payload)


@router.delete("/taxes/{tax_id}", status_code=204)
def delete_tax(tax_id: int, db: Session = Depends(get_db), _=Depends(admin_only)):
    return deactivate(db, get_or_404(db, Tax, tax_id, "Tax"))


# ---------- discounts (admin only to write) ----------
@router.post("/discounts", response_model=schemas.DiscountOut, status_code=201)
def create_discount(payload: schemas.DiscountCreate, db: Session = Depends(get_db), _=Depends(admin_only)):
    return create_obj(db, Discount, payload)


@router.get("/discounts", response_model=schemas.Page[schemas.DiscountOut])
def list_discounts(
    search: str | None = None,
    is_active: bool | None = None,
    pg=Depends(page_params),
    db: Session = Depends(get_db),
    _=Depends(staff_or_admin),
):
    stmt = select(Discount).order_by(Discount.id.desc())
    if search:
        like = f"%{search}%"
        stmt = stmt.where(Discount.name.ilike(like) | Discount.code.ilike(like))
    if is_active is not None:
        stmt = stmt.where(Discount.is_active == is_active)
    return service.paginate(db, stmt, *pg)


@router.get("/discounts/{discount_id}", response_model=schemas.DiscountOut)
def get_discount(discount_id: int, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    return get_or_404(db, Discount, discount_id, "Discount")


@router.patch("/discounts/{discount_id}", response_model=schemas.DiscountOut)
def update_discount(discount_id: int, payload: schemas.DiscountUpdate, db: Session = Depends(get_db), _=Depends(admin_only)):
    return update_obj(db, get_or_404(db, Discount, discount_id, "Discount"), payload)


@router.delete("/discounts/{discount_id}", status_code=204)
def delete_discount(discount_id: int, db: Session = Depends(get_db), _=Depends(admin_only)):
    return deactivate(db, get_or_404(db, Discount, discount_id, "Discount"))


# ---------- quotation templates ----------
def _check_lines(db: Session, lines, plan_id: int | None = None) -> None:
    try:
        service.validate_template_lines(db, lines, plan_id=plan_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))


def _load_template(db: Session, template_id: int) -> QuotationTemplate:
    stmt = (
        select(QuotationTemplate)
        .options(selectinload(QuotationTemplate.lines))
        .where(QuotationTemplate.id == template_id)
    )
    tpl = db.scalars(stmt).first()
    if tpl is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quotation template not found")
    return tpl


@router.post("/quotation-templates", response_model=schemas.TemplateOut, status_code=201)
def create_template(payload: schemas.TemplateCreate, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    _check_lines(db, payload.lines, plan_id=payload.plan_id)
    tpl_lines = []
    for line in payload.lines:
        line_data = line.model_dump()
        if line_data.get("unit_price") is None:
            prod = db.get(Product, line.product_id)
            line_data["unit_price"] = prod.base_price
        tpl_lines.append(QuotationTemplateLine(**line_data))
    tpl = QuotationTemplate(
        name=payload.name,
        plan_id=payload.plan_id,
        validity_days=payload.validity_days,
        lines=tpl_lines,
    )
    db.add(tpl)
    save(db)
    return _load_template(db, tpl.id)


@router.get("/quotation-templates", response_model=schemas.Page[schemas.TemplateOut])
def list_templates(
    search: str | None = None,
    pg=Depends(page_params),
    db: Session = Depends(get_db),
    _=Depends(any_user),
):
    stmt = select(QuotationTemplate).options(selectinload(QuotationTemplate.lines)).order_by(QuotationTemplate.id.desc())
    if search:
        stmt = stmt.where(QuotationTemplate.name.ilike(f"%{search}%"))
    return service.paginate(db, stmt, *pg)


@router.get("/quotation-templates/{template_id}", response_model=schemas.TemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db), _=Depends(any_user)):
    return _load_template(db, template_id)


@router.patch("/quotation-templates/{template_id}", response_model=schemas.TemplateOut)
def update_template(template_id: int, payload: schemas.TemplateUpdate, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    tpl = _load_template(db, template_id)
    plan_id = payload.plan_id or tpl.plan_id
    if payload.lines is not None:
        _check_lines(db, payload.lines, plan_id=plan_id)
        tpl_lines = []
        for line in payload.lines:
            line_data = line.model_dump()
            if line_data.get("unit_price") is None:
                prod = db.get(Product, line.product_id)
                line_data["unit_price"] = prod.base_price
            tpl_lines.append(QuotationTemplateLine(**line_data))
        tpl.lines = tpl_lines
    update_obj(db, tpl, payload, skip=("lines",))
    return _load_template(db, template_id)


@router.delete("/quotation-templates/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db), _=Depends(staff_or_admin)):
    tpl = get_or_404(db, QuotationTemplate, template_id, "Quotation template")
    try:
        db.delete(tpl)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Quotation template is in use and cannot be deleted",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
