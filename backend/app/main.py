from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.modules.auth.router import router as auth_router
from app.modules.catalog.router import router as catalog_router
from app.modules.billing.router import router as billing_router
from app.modules.reports.router import router as reports_router

app = FastAPI(title="Brightloop Subscription Management")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

for r in (auth_router, catalog_router, billing_router, reports_router):
    app.include_router(r)

@app.get("/health")
def health():
    return {"status": "ok"}