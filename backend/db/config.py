from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://instacrane:instacrane@localhost:5432/instacrane"

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "minioaccess"
    s3_secret_key: str = "miniosecret"
    s3_bucket_name: str = "instacrane-media"
    s3_region: str = "fr-par"

    app_env: str = "development"
    app_url: str = "http://localhost:5173"
    api_url: str = "http://localhost:8000"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
