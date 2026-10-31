from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)
body = {"plan_id": 1, "lines": [{"product_id": 1, "tax_id": 1, "quantity": 2, "unit_price": "100.00"}]}

# 1. create and activate
r = c.post("/subscriptions", json=body)
assert r.status_code == 201, r.text
sid = r.json()["id"]
for s in ["quotation", "confirmed", "active"]:
    r = c.patch(f"/subscriptions/{sid}/status", json={"status": s})
    assert r.status_code == 200, r.text
print("1. subscription active:", sid)

# 2. invalid transition is rejected
d = c.post("/subscriptions", json=body).json()["id"]
r = c.patch(f"/subscriptions/{d}/status", json={"status": "closed"})
assert r.status_code == 409, r.text
print("2. invalid transition blocked (409)")

# 3. billing runs twice, no double invoice
c.post("/admin/run-billing")
second = c.post("/admin/run-billing").json()
assert second["invoices_created"] == 0, second
items = c.get("/invoices", params={"subscription_id": sid}).json()["items"]
assert len(items) == 1, items
inv = items[0]
assert inv["total"] == "236.00", inv["total"]
print("3. one invoice, total 236.00, no double billing")

# 4. confirm and pay
assert c.post(f"/invoices/{inv['id']}/confirm").status_code == 200
r = c.post(f"/invoices/{inv['id']}/payments", json={"amount": "236.00", "method": "cash"})
assert r.status_code == 201, r.text
assert c.get(f"/invoices/{inv['id']}").json()["status"] == "paid"
print("4. invoice paid")

# 5. overpayment rejected
r = c.post(f"/invoices/{inv['id']}/payments", json={"amount": "1.00", "method": "cash"})
assert r.status_code == 409, r.text
print("5. extra payment blocked (409)")

print("\nALL CHECKS PASSED")
