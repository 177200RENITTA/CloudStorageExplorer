import os
import uuid

import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException, UploadFile

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION,
)


def upload_file_to_s3(file: UploadFile, user_id: int) -> dict:
    """Uploads an UploadFile to S3 under a per-user prefix and returns its
    object key, URL, and size in bytes."""
    file_extension = os.path.splitext(file.filename)[1]
    unique_key = f"user_{user_id}/{uuid.uuid4().hex}{file_extension}"

    try:
        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)

        s3_client.upload_fileobj(
            file.file,
            S3_BUCKET_NAME,
            unique_key,
            ExtraArgs={"ContentType": file.content_type or "application/octet-stream"},
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"S3 upload failed: {str(e)}")

    file_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{unique_key}"
    return {"key": unique_key, "url": file_url, "size": file_size}


def delete_file_from_s3(file_key: str) -> None:
    try:
        s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=file_key)
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"S3 delete failed: {str(e)}")


def generate_presigned_download_url(file_key: str, filename: str, expires_in: int = 3600) -> str:
    """Generates a time-limited download link so files can stay in a private
    (non-public) S3 bucket."""
    try:
        return s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": file_key,
                "ResponseContentDisposition": f'attachment; filename="{filename}"',
            },
            ExpiresIn=expires_in,
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Could not generate download link: {str(e)}")