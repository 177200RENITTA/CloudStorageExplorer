from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)  # bcrypt hash, never plain text

    files = relationship(
        "FileMetadata", back_populates="owner", cascade="all, delete-orphan"
    )


class FileMetadata(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False, index=True)
    file_key = Column(String, nullable=False)   # object key inside the S3 bucket
    file_url = Column(String, nullable=False)   # public/base S3 URL
    file_size = Column(BigInteger, default=0)   # size in bytes
    upload_date = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="files")