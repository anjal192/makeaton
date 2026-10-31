import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
PASSWORD = "Strong#Pass1"
ADMIN_EMAIL = "admin@brightloop.local"
ADMIN_PASSWORD = "Admin#12345"


def new_email():
    return f"user{uuid.uuid4().hex[:8]}@example.com"


def signup(email, password=PASSWORD, name="Test User"):
    return client.post("/auth/signup",
                       json={"full_name": name, "email": email, "password": password})


def login(email, password):
    return client.post("/auth/login", data={"username": email, "password": password})


def auth_header(email, password=PASSWORD):
    token = login(email, password).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------- signup ----------

def test_signup_and_login():
    email = new_email()
    r = signup(email)
    assert r.status_code == 201
    assert r.json()["role"] == "customer"
    assert "password" not in r.json() and "password_hash" not in r.json()
    r = login(email, PASSWORD)
    assert r.status_code == 200
    assert r.json()["user"]["email"] == email


def test_email_is_stored_lowercase():
    email = new_email()
    r = signup(email.upper())
    assert r.status_code == 201
    assert r.json()["email"] == email


def test_duplicate_email_rejected_case_insensitively():
    email = new_email()
    assert signup(email).status_code == 201
    r = signup(email.upper())
    assert r.status_code == 409
    assert r.json()["field"] == "email"


@pytest.mark.parametrize("pw", [
    "Abcdef1!",         # exactly 8 characters: not allowed
    "alllowercase1!",   # no uppercase
    "ALLUPPERCASE1!",   # no lowercase
    "NoSpecial123",     # no special character
    "short",            # too short
])
def test_weak_passwords_rejected(pw):
    r = signup(new_email(), pw)
    assert r.status_code == 422
    assert r.json()["errors"][0]["field"] == "password"


def test_nine_character_password_accepted():
    assert signup(new_email(), "Abcdef1!x").status_code == 201


def test_invalid_email_rejected():
    r = signup("not-an-email")
    assert r.status_code == 422
    assert r.json()["errors"][0]["field"] == "email"


def test_short_name_rejected():
    assert signup(new_email(), name="A").status_code == 422


# ---------- login ----------

def test_wrong_password_rejected():
    email = new_email()
    signup(email)
    assert login(email, "Wrong#Pass9").status_code == 401


def test_unknown_email_gets_same_error_as_wrong_password():
    email = new_email()
    signup(email)
    a = login(email, "Wrong#Pass9")
    b = login(new_email(), "Wrong#Pass9")
    assert a.status_code == b.status_code == 401
    assert a.json()["detail"] == b.json()["detail"]


# ---------- roles ----------

def test_me_requires_token():
    assert client.get("/auth/me").status_code == 401


def test_me_returns_current_user():
    email = new_email()
    signup(email)
    r = client.get("/auth/me", headers=auth_header(email))
    assert r.status_code == 200
    assert r.json()["email"] == email


def test_customer_cannot_create_staff():
    email = new_email()
    signup(email)
    r = client.post("/auth/staff", headers=auth_header(email),
                    json={"full_name": "Sneaky", "email": new_email(), "password": PASSWORD})
    assert r.status_code == 403


def test_admin_can_create_staff():
    r = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if r.status_code != 200:
        pytest.skip("Create the admin first: python -m app.create_admin ...")
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    staff_email = new_email()
    r = client.post("/auth/staff", headers=headers,
                    json={"full_name": "Staff Person", "email": staff_email, "password": PASSWORD})
    assert r.status_code == 201
    assert r.json()["role"] == "staff"
    # staff cannot create more staff
    r = client.post("/auth/staff", headers=auth_header(staff_email),
                    json={"full_name": "Another", "email": new_email(), "password": PASSWORD})
    assert r.status_code == 403


# ---------- password reset ----------

def test_forgot_password_same_answer_for_unknown_email(monkeypatch):
    monkeypatch.setattr("app.modules.auth.router.send_email", lambda *a, **k: None)
    real = signup(new_email())
    r = client.post("/auth/forgot-password", json={"email": new_email()})
    assert r.status_code == 200
    assert "reset link" in r.json()["detail"]


def test_full_reset_flow(monkeypatch):
    sent = {}
    monkeypatch.setattr("app.modules.auth.router.send_email",
                        lambda to, subject, body: sent.update(to=to, body=body))
    email = new_email()
    signup(email)

    r = client.post("/auth/forgot-password", json={"email": email})
    assert r.status_code == 200
    assert sent["to"] == email
    token = sent["body"].split("token=")[1].split()[0]

    # weak new password is rejected
    r = client.post("/auth/reset-password", json={"token": token, "new_password": "weak"})
    assert r.status_code == 422

    # good new password works
    new_pw = "NewStrong#Pass2"
    r = client.post("/auth/reset-password", json={"token": token, "new_password": new_pw})
    assert r.status_code == 200
    assert login(email, new_pw).status_code == 200
    assert login(email, PASSWORD).status_code == 401

    # the same token cannot be used twice
    r = client.post("/auth/reset-password", json={"token": token, "new_password": "Another#Pass3"})
    assert r.status_code == 400


def test_bad_reset_token_rejected():
    r = client.post("/auth/reset-password",
                    json={"token": "x" * 40, "new_password": "NewStrong#Pass2"})
    assert r.status_code == 400