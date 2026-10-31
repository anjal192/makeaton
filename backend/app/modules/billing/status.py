from fastapi import HTTPException

SUBSCRIPTION_FLOW = {
    "draft": {"quotation", "confirmed"},
    "quotation": {"confirmed"},
    "confirmed": {"active"},
    "active": {"closed"},
    "closed": set(),
}

INVOICE_FLOW = {
    "draft": {"confirmed", "cancelled"},
    "confirmed": {"paid", "cancelled"},
    "paid": set(),
    "cancelled": set(),
}


def transition(obj, new_status: str, flow: dict):
    """The only place a status may change. Raises 409 on an invalid move."""
    if new_status not in flow.get(obj.status, set()):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot change status from '{obj.status}' to '{new_status}'",
        )
    obj.status = new_status
