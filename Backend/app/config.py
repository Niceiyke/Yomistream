from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    OPENAI_API_KEY: str
    GROQ_API_KEY: str
    MODEL_NAME: str = "deepseek-r1-distill-llama-70b"
    WHISPER_MODEL: str = "tiny"

    # Supabase / Auth
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str
    SUPABASE_JWKS_URL: str

    # Server config
    PORT: int = 8001
    FRONTEND_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    @property
    def frontend_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
