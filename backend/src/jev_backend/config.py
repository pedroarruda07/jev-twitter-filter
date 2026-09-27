from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT / ".env", env_file_encoding="utf-8", extra="ignore", env_prefix="JEV_"
    )

    api_key: SecretStr = Field(min_length=1)
    model: str = "jev-latest"
    timeout_seconds: float = Field(default=15, gt=0, le=20)
    max_concurrency: int = Field(default=12, ge=1, le=100)
