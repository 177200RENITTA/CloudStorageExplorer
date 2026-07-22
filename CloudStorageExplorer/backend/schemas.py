from datetime import datetime
from typing import List

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class FileOut(BaseModel):
    id: int
    filename: str
    file_url: str
    file_size: int
    upload_date: datetime

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    username: str
    total_files: int
    total_storage_bytes: int
    recent_uploads: List[FileOut]