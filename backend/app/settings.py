from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://portal:portal@localhost:5432/portal"
    app_version: str = "dev"
    log_level: str = "INFO"
    # Optional daily token budget for AI parsing. When set, the /ops/ai-cost
    # dashboard shows an alert if today's token total exceeds the budget.
    ai_parse_budget_tokens_per_day: int | None = None

    # Azure OpenAI — answer-card synthesis (Phase 3 task 3.3).
    # Auth: managed identity in production (no api_key needed when the
    # App Service identity has AOAI role assignment). For local dev / CI,
    # set AZURE_OPENAI_API_KEY and the SDK picks it up automatically.
    azure_openai_endpoint: str | None = None
    azure_openai_api_version: str = "2024-08-01-preview"
    azure_openai_deployment_name: str | None = None


settings = Settings()
