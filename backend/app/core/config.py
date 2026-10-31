from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 60
    RESET_TOKEN_MINUTES: int = 30
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    FRONTEND_URL: str = "http://localhost:5173"

settings = Settings()