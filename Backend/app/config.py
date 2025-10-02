from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # Mark keys Optional for static analysis tools; runtime validation ensures they exist.
    OPENAI_API_KEY: str | None = None
    GROQ_API_KEY: str | None = None
    MODEL_NAME: str = "deepseek-r1-distill-llama-70b"
    WHISPER_MODEL: str = "tiny"

    # Supabase / Auth
    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    SUPABASE_JWT_SECRET: str | None = None
    SUPABASE_JWKS_URL: str | None = None

    # YouTube
    YOUTUBE_API_KEY: str | None = None

    # Server config
    PORT: int = 8001
    FRONTEND_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    @property
    def frontend_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
# runtime validation: fail early if required secrets are not provided
def _validate_required_settings(s: Settings) -> None:
    missing: list[str] = []
    required_fields = [
        "OPENAI_API_KEY",
        "GROQ_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_JWT_SECRET",
        "SUPABASE_JWKS_URL",
        "YOUTUBE_API_KEY",
    ]
    for f in required_fields:
        if getattr(s, f) in (None, ""):
            missing.append(f)
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

_validate_required_settings(settings)
