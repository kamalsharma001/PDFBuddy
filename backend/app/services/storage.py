import os
from abc import ABC, abstractmethod
from pathlib import Path
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from ..config import get_settings


class BaseStorageService(ABC):
    @abstractmethod
    def upload_file(self, file_bytes: bytes, key: str, content_type: str = "application/pdf") -> str:
        """Uploads file bytes to storage and returns the key."""
        pass

    @abstractmethod
    def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generates a short-lived presigned URL for viewing/downloading the file."""
        pass

    @abstractmethod
    def delete_file(self, key: str) -> bool:
        """Deletes file from storage."""
        pass


class CloudflareR2Storage(BaseStorageService):
    """Cloudflare R2 Storage using S3-compatible API (Standard Storage class, free tier)."""

    def __init__(self) -> None:
        settings = get_settings()
        self.bucket = settings.r2_bucket_name
        endpoint_url = f"https://{settings.r2_account_id}.r2.cloudflarestorage.com"

        s3_config = Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        )

        self.client = boto3.client(
            service_name="s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
            config=s3_config,
        )

    def upload_file(self, file_bytes: bytes, key: str, content_type: str = "application/pdf") -> str:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        return key

    def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def delete_file(self, key: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False


class LocalStorageService(BaseStorageService):
    """Local filesystem storage for offline development when Cloudflare R2 is unset."""

    def __init__(self, base_dir: str = "./uploads") -> None:
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def upload_file(self, file_bytes: bytes, key: str, content_type: str = "application/pdf") -> str:
        target_path = self.base_dir / key
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(file_bytes)
        return key

    def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        return f"{backend_url}/documents/raw/{key}"

    def delete_file(self, key: str) -> bool:
        target_path = self.base_dir / key
        if target_path.exists():
            target_path.unlink()
            return True
        return False


def get_storage_service() -> BaseStorageService:
    settings = get_settings()
    # Use Cloudflare R2 if credentials and account ID are provided
    if settings.r2_account_id and settings.r2_access_key_id and settings.r2_secret_access_key:
        return CloudflareR2Storage()
    
    # In production, do not fall back to ephemeral filesystem storage
    if settings.environment == "production":
        raise RuntimeError(
            "Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) "
            "are required in production environment."
        )

    # Default to local storage for local offline development
    return LocalStorageService(base_dir=settings.local_storage_dir)
