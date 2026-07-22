import os
from datetime import timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from database import engine, get_db
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from s3_service import upload_file_to_s3, delete_file_from_s3, generate_presigned_download_url

# Create all database tables on startup (SQLite file is created automatically).
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cloud Storage Explorer", version="1.0.0")

# Allow the frontend to call this API. Restrict allow_origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the HTML/CSS/JS frontend from a "static" folder, if present.
if os.path.isdir("static"):
    app.mount("/static", StaticFiles(directory="static", html=True), name="static")


# ---------------------------------------------------------------------------
# Authentication (Router updated with "/auth" prefix to match script.js)
# ---------------------------------------------------------------------------

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])

@auth_router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = (
        db.query(models.User)
        .filter((models.User.username == user.username) | (models.User.email == user.email))
        .first()
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")

    new_user = models.User(
        username=user.username,
        email=user.email,
        password=hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@auth_router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@auth_router.get("/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user

# Include the authentication router into our main app
app.include_router(auth_router)


# ---------------------------------------------------------------------------
# Dashboard Stats (CORRECTED: Endpoint mapped to /files/stats for frontend sync)
# ---------------------------------------------------------------------------

@app.get("/files/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    total_files = (
        db.query(func.count(models.FileMetadata.id))
        .filter(models.FileMetadata.user_id == current_user.id)
        .scalar()
    ) or 0
    
    total_storage = (
        db.query(func.coalesce(func.sum(models.FileMetadata.file_size), 0))
        .filter(models.FileMetadata.user_id == current_user.id)
        .scalar()
    ) or 0
    
    recent_uploads = (
        db.query(models.FileMetadata)
        .filter(models.FileMetadata.user_id == current_user.id)
        .order_by(models.FileMetadata.upload_date.desc())
        .limit(5)
        .all()
    )

    return schemas.DashboardStats(
        username=current_user.username,
        total_files=total_files,
        total_storage_bytes=total_storage,
        recent_uploads=recent_uploads,
    )


# ---------------------------------------------------------------------------
# File Upload
# ---------------------------------------------------------------------------

@app.post("/files/upload", response_model=schemas.FileOut, status_code=status.HTTP_201_CREATED)
def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    upload_result = upload_file_to_s3(file, current_user.id)

    file_record = models.FileMetadata(
        filename=file.filename,
        file_key=upload_result["key"],
        file_url=upload_result["url"],
        file_size=upload_result["size"],
        user_id=current_user.id,
    )
    db.add(file_record)
    db.commit()
    db.refresh(file_record)
    return file_record


# ---------------------------------------------------------------------------
# File Listing & Search
# ---------------------------------------------------------------------------

@app.get("/files", response_model=List[schemas.FileOut])
def list_files(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.FileMetadata).filter(models.FileMetadata.user_id == current_user.id)

    if search:
        query = query.filter(models.FileMetadata.filename.ilike(f"%{search}%"))

    return query.order_by(models.FileMetadata.upload_date.desc()).all()


# ---------------------------------------------------------------------------
# File Download
# ---------------------------------------------------------------------------

@app.get("/files/{file_id}/download")
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    file_record = (
        db.query(models.FileMetadata)
        .filter(models.FileMetadata.id == file_id, models.FileMetadata.user_id == current_user.id)
        .first()
    )
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    download_url = generate_presigned_download_url(file_record.file_key, file_record.filename)
    return {"download_url": download_url}


# ---------------------------------------------------------------------------
# File Delete
# ---------------------------------------------------------------------------

@app.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    file_record = (
        db.query(models.FileMetadata)
        .filter(models.FileMetadata.id == file_id, models.FileMetadata.user_id == current_user.id)
        .first()
    )
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    delete_file_from_s3(file_record.file_key)
    db.delete(file_record)
    db.commit()
    return None


@app.get("/")
def root():
    return {"message": "Cloud Storage Explorer API is running"}