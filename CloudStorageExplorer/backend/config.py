from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central place for every configurable value in the project.
    Values are read from environment variables, or from a .env file
    in the project root if one exists. See .env.example for the list
    of variables you need to set.
    """

    # --- Security / JWT ---------------------------------------------------
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # --- Database ------------------------------------------------------
    DATABASE_URL: str = "sqlite:///./cloud_storage.db"

    # --- AWS S3 ----------------------------------------------------------
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = ""

    # --- App -------------------------------------------------------------
    APP_NAME: str = "Cloud Storage Explorer"
    APP_VERSION: str = "1.0.0"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


# Import this single instance everywhere instead of re-reading env vars.
settings = Settings()