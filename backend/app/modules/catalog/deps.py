"""Glue between the catalog module and the rest of the app (A's code lives in app.core)."""
from app.core.db import Base, get_db
from app.core.deps import Role, require_role


def _role(name: str):
    """Find the Role member whatever its spelling (ADMIN / admin / Admin)."""
    for attr in (name.upper(), name.lower(), name.capitalize()):
        if hasattr(Role, attr):
            return getattr(Role, attr)
    return Role(name)


ADMIN, STAFF, CUSTOMER = _role("admin"), _role("staff"), _role("customer")

admin_only = require_role(ADMIN)
staff_or_admin = require_role(ADMIN, STAFF)
any_user = require_role(ADMIN, STAFF, CUSTOMER)

__all__ = ["Base", "get_db", "admin_only", "staff_or_admin", "any_user"]