import uuid

import boto3
from fastapi import UploadFile

from db.config import settings

s3_client = boto3.client(
    "s3",
    endpoint_url=settings.s3_endpoint_url,
    aws_access_key_id=settings.s3_access_key,
    aws_secret_access_key=settings.s3_secret_key,
    region_name=settings.s3_region,
)


async def upload_file(file: UploadFile, folder: str) -> str:
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    key = f"{folder}/{uuid.uuid4()}.{ext}"

    content = await file.read()
    s3_client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=content,
        ContentType=file.content_type or "image/jpeg",
    )

    return f"{settings.s3_endpoint_url}/{settings.s3_bucket_name}/{key}"
