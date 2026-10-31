from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

class AppError(Exception):
    def __init__(self, status_code: int, detail: str, field: str | None = None):
        self.status_code, self.detail, self.field = status_code, detail, field

def register_error_handlers(app: FastAPI):
    @app.exception_handler(AppError)
    async def app_error(request: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code,
                            content={"detail": exc.detail, "field": exc.field})

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        errors = []
        for e in exc.errors():
            field = ".".join(str(p) for p in e["loc"] if p not in ("body", "query", "path"))
            errors.append({"field": field,
                           "message": e["msg"].removeprefix("Value error, ")})
        return JSONResponse(status_code=422,
                            content={"detail": "Validation failed", "errors": errors})