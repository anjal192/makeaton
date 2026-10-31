import uuid
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
ADMIN_EMAIL = "admin@brightloop.local"
ADMIN_PASSWORD = "Admin#12345"
PASSWORD = "Strong#Pass1"


def new_id():
    return uuid.uuid4().hex[:6]


def get_admin_headers():
    r = client.post("/auth/login", data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, "Admin login failed"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def get_staff_headers():
    admin_hdr = get_admin_headers()
    staff_email = f"staff_{new_id()}@example.com"
    r = client.post(
        "/auth/staff",
        headers=admin_hdr,
        json={"full_name": "Staff User", "email": staff_email, "password": PASSWORD},
    )
    assert r.status_code == 201
    r = client.post("/auth/login", data={"username": staff_email, "password": PASSWORD})
    assert r.status_code == 200
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def get_customer_headers():
    cust_email = f"cust_{new_id()}@example.com"
    r = client.post(
        "/auth/signup",
        json={"full_name": "Customer User", "email": cust_email, "password": PASSWORD},
    )
    assert r.status_code == 201
    r = client.post("/auth/login", data={"username": cust_email, "password": PASSWORD})
    assert r.status_code == 200
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ==================== Section 5.3: Verification in Order ====================

def test_1_create_tax():
    headers = get_admin_headers()
    r = client.post("/catalog/taxes", headers=headers, json={"name": f"GST_{new_id()}", "rate_percent": 18})
    assert r.status_code == 201
    data = r.json()
    assert float(data["rate_percent"]) == 18.0
    assert data["is_active"] is True


def test_2_create_product():
    headers = get_admin_headers()
    sku = f"pro-{new_id()}"
    r = client.post(
        "/catalog/products",
        headers=headers,
        json={"name": "Pro Software", "sku": sku, "base_price": 99.00},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["sku"] == sku.upper()
    assert float(data["base_price"]) == 99.00


def test_3_create_variant():
    headers = get_admin_headers()
    sku_prod = f"pro-{new_id()}"
    prod = client.post(
        "/catalog/products",
        headers=headers,
        json={"name": "Pro Software Suite", "sku": sku_prod, "base_price": 99.00},
    ).json()

    sku_var = f"{sku_prod}-l"
    r = client.post(
        f"/catalog/products/{prod['id']}/variants",
        headers=headers,
        json={"name": "Large", "sku": sku_var, "extra_price": 10},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["sku"] == sku_var.upper()
    assert float(data["extra_price"]) == 10.00
    assert data["product_id"] == prod["id"]


def test_4_create_plan():
    headers = get_admin_headers()
    name = f"Monthly_{new_id()}"
    r = client.post(
        "/catalog/plans",
        headers=headers,
        json={"name": name, "billing_period": "monthly", "price": 49.00},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == name
    assert data["billing_period"] == "monthly"
    assert float(data["price"]) == 49.00


def test_5_create_discount():
    headers = get_admin_headers()
    name = f"Welcome_{new_id()}"
    r = client.post(
        "/catalog/discounts",
        headers=headers,
        json={"name": name, "discount_type": "percent", "value": 10, "usage_limit": 2},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == name
    assert data["discount_type"] == "percent"
    assert float(data["value"]) == 10.00
    assert data["usage_limit"] == 2
    assert data["used_count"] == 0


def test_6_get_products_search():
    headers = get_admin_headers()
    sku = f"pro-srch-{new_id()}"
    client.post(
        "/catalog/products",
        headers=headers,
        json={"name": f"Pro Software {sku}", "sku": sku, "base_price": 99.00},
    )
    r = client.get("/catalog/products?search=pro&page=1&size=20", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1
    assert any("pro" in p["sku"].lower() or "pro" in p["name"].lower() for p in data["items"])


def test_7_quotation_template_create_list():
    headers = get_admin_headers()
    # Create product and plan
    sku = f"tpl-prod-{new_id()}"
    prod = client.post(
        "/catalog/products",
        headers=headers,
        json={"name": "Template Prod", "sku": sku, "base_price": 50.00},
    ).json()

    plan = client.post(
        "/catalog/plans",
        headers=headers,
        json={"name": f"Template Plan {new_id()}", "billing_period": "monthly", "price": 20.00},
    ).json()

    tpl_name = f"Standard Template {new_id()}"
    r = client.post(
        "/catalog/quotation-templates",
        headers=headers,
        json={
            "name": tpl_name,
            "plan_id": plan["id"],
            "validity_days": 45,
            "lines": [{"product_id": prod["id"], "quantity": 2, "unit_price": 50.00}],
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == tpl_name
    assert data["plan_id"] == plan["id"]
    assert data["validity_days"] == 45
    assert len(data["lines"]) == 1
    assert data["lines"][0]["product_id"] == prod["id"]
    assert float(data["lines"][0]["unit_price"]) == 50.00

    # List templates
    list_r = client.get("/catalog/quotation-templates", headers=headers)
    assert list_r.status_code == 200
    list_data = list_r.json()
    assert "items" in list_data
    assert any(t["id"] == data["id"] for t in list_data["items"])


# ==================== Section 5.4: Negative Checks ====================

def test_negative_duplicate_sku_returns_409():
    headers = get_admin_headers()
    sku = f"dupsku-{new_id()}"
    r1 = client.post("/catalog/products", headers=headers, json={"name": "Prod 1", "sku": sku, "base_price": 10})
    assert r1.status_code == 201

    r2 = client.post("/catalog/products", headers=headers, json={"name": "Prod 2", "sku": sku, "base_price": 20})
    assert r2.status_code == 409


def test_negative_price_returns_422():
    headers = get_admin_headers()
    r = client.post(
        "/catalog/products",
        headers=headers,
        json={"name": "Bad Price", "sku": f"bad-{new_id()}", "base_price": -10.00},
    )
    assert r.status_code == 422


def test_percent_discount_over_100_returns_422():
    headers = get_admin_headers()
    r = client.post(
        "/catalog/discounts",
        headers=headers,
        json={"name": "Over 100", "discount_type": "percent", "value": 150},
    )
    assert r.status_code == 422


def test_discount_end_date_before_start_date_returns_422():
    headers = get_admin_headers()
    r = client.post(
        "/catalog/discounts",
        headers=headers,
        json={
            "name": "Invalid Dates",
            "discount_type": "fixed",
            "value": 10,
            "start_date": "2026-10-31",
            "end_date": "2026-10-01",
        },
    )
    assert r.status_code == 422


def test_staff_or_customer_token_on_post_taxes_returns_403():
    staff_headers = get_staff_headers()
    r_staff = client.post("/catalog/taxes", headers=staff_headers, json={"name": "StaffTax", "rate_percent": 10})
    assert r_staff.status_code == 403

    cust_headers = get_customer_headers()
    r_cust = client.post("/catalog/taxes", headers=cust_headers, json={"name": "CustTax", "rate_percent": 10})
    assert r_cust.status_code == 403


def test_no_token_returns_401():
    r = client.get("/catalog/products")
    assert r.status_code == 401
    r_post = client.post("/catalog/taxes", json={"name": "NoAuthTax", "rate_percent": 5})
    assert r_post.status_code == 401
