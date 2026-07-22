# ☁️ Cloud Storage Explorer

A cloud-based file storage and management web application developed using **FastAPI**, **Amazon S3**, **SQLite**, and **HTML, CSS, JavaScript**.

This project allows users to securely upload, manage, and download files through a simple web interface.

---

# Project Overview

Cloud Storage Explorer is designed to provide a secure and user-friendly platform for storing files in the cloud. The application uses Amazon S3 as the cloud storage service and FastAPI as the backend framework.

Users can:

- Register a new account
- Log in securely
- Upload files
- View uploaded files
- Delete files
- Manage personal cloud storage

---

# Features

- User Registration
- Secure Login Authentication
- File Upload
- File Listing
- File Deletion
- Amazon S3 Cloud Storage Integration
- Storage Usage Dashboard
- REST API using FastAPI
- Responsive User Interface

---

# Technologies Used

## Frontend

- HTML5
- CSS3
- JavaScript

## Backend

- FastAPI
- Python
- SQLAlchemy
- Pydantic

## Database

- SQLite

## Cloud Services

- Amazon S3
- Boto3

## Development Tools

- Visual Studio Code
- Git
- GitHub
- Postman
- Swagger UI

---

# Project Structure

```text
CloudStorageExplorer/
│
├── backend/
│   ├── auth.py
│   ├── config.py
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   ├── s3_service.py
│   └── schemas.py
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   ├── upload.html
│   └── files.html
│
├── static/
│   ├── css/
│   ├── js/
│   └── images/
│
├── .env
├── requirements.txt
└── README.md
```

---

# Installation

## Clone the repository

```bash
git clone https://github.com/yourusername/CloudStorageExplorer.git
```

## Open the project

```bash
cd CloudStorageExplorer
```

## Create Virtual Environment

```bash
python -m venv venv
```

## Activate Virtual Environment

### Windows

```bash
.\venv\Scripts\Activate.ps1
```

### macOS/Linux

```bash
source venv/bin/activate
```

## Install Dependencies

```bash
pip install -r requirements.txt
```

---

# Configure Environment Variables

Create a `.env` file in the project root and add:

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your_bucket_name

SECRET_KEY=your_secret_key
ALGORITHM=HS256

DATABASE_URL=sqlite:///./cloud_storage.db
```

---

# Run the Application

Go to the backend folder:

```bash
cd backend
```

Start the FastAPI server:

```bash
python -m uvicorn main:app --reload
```

Open:

```
http://127.0.0.1:8000/docs
```

to access the Swagger API documentation.

---

# API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | Home |
| POST | /register | Register User |
| POST | /login | User Login |
| POST | /upload | Upload File |
| GET | /files | List Uploaded Files |
| DELETE | /files/{id} | Delete File |

---

# Future Enhancements

- File Sharing
- Folder Management
- File Preview
- Password Reset
- Email Verification
- Storage Analytics
- Drag-and-Drop Upload
- Multi-file Upload
- File Versioning

---

# Screenshots

Add screenshots of:

- Landing Page
- Login Page
- Register Page
- Dashboard
- Upload Page
- Swagger API
- AWS S3 Bucket

---

# Author

**Renitta J**



---

# License

This project is developed for educational and internship purposes.