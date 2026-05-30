from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://portal:portal@localhost:5432/portal"
    app_version: str = "dev"
    log_level: str = "INFO"


settings = Settings()
