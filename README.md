<div align="center">

# 📚 SMS — School Management System

**A full-stack school management application for academic institutions**

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![Django](https://img.shields.io/badge/Django-5.2-092E20?style=flat&logo=django&logoColor=white)](https://djangoproject.com)
[![DRF](https://img.shields.io/badge/Django_REST_Framework-3.17-ff1709?style=flat)](https://www.django-rest-framework.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev)
[![MySQL](https://img.shields.io/badge/MySQL-9.5-4479A1?style=flat&logo=mysql&logoColor=white)](https://mysql.com)
[![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)](https://jwt.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Architecture](#-architecture) · [Author](#-author)

---

> *Developed as a capstone project for the ISA programme (Informatique et Systèmes d'Application), now deployed in a real academic institution.*

</div>

---

## 🖼️ Screenshots

> *Screenshots / demo GIF coming soon.*

---

## ✨ Features

SMS covers the complete lifecycle of a school, from enrolment to graduation.

### 🏫 Academic Structure
- **Multi-institution** support with per-établissement data isolation
- Departments, specialities, classes, and academic years
- Configurable grade scales per institution type (Primary / Secondary / Higher Education)
- Bilingual interface **French 🇫🇷 / English 🇬🇧** with live toggle

### 👩‍🎓 Students & Staff
- Full student registry (personal data, guardians, region, CNI)
- Teacher management with qualifications and assignments
- Role-based access control (Admin, Secretary, Teacher, Student)

### 📋 Enrolment & Finance
- Student enrolment with automatic tuition fee calculation
- Multi-tranche payment tracking with invoicing
- Payment receipts and overdue balance alerts

### 📆 Academic Management
- **Weekly (HEBDO) & Intensive** timetable builder with PDF export
- Session & attendance tracking with digital sign-off
- Course catalogue with subject–class–teacher assignments

### 📊 Evaluations & Grades
- Configurable evaluation types (CC, DS, TP, Exam…)
- Grade sheets per class and per subject
- Automated average calculation and mention assignment
- Jury decisions (admitted / deferred / repeated year)

### 📄 Documents & Reports
- Student cards with QR code
- Exam convocations
- Internship management
- Statistics report (pass rates, gender breakdown, department enrolment)
- Complete audit log

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, React Router v6, Axios, Chart.js, Vite 7 |
| **Backend** | Django 5.2, Django REST Framework 3.17 |
| **Auth** | JWT via `djangorestframework-simplejwt` (24 h access / 30 d refresh) |
| **Database** | MySQL 9.5 |
| **Styling** | Custom CSS design system (dark / light theme) |
| **i18n** | Hand-rolled FR/EN translation layer |
| **CORS** | `django-cors-headers` |
| **Filters** | `django-filter` |

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11 + |
| Node.js | 18 + |
| MySQL | 9.x |
| npm | 9 + |

### 1 — Clone the repository

```bash
git clone https://github.com/LuckyCifer/sms-django-react.git
cd sms-django-react
```

### 2 — Database setup

Create the MySQL database and import the schema:

```sql
CREATE DATABASE sms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> Import the schema from `scripts/schema.sql` if provided, or run Django migrations (step 4).

### 3 — Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create the environment file:

```bash
# Copy the example and fill in your values
cp .env.example .env
```

`.env` variables:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
DB_NAME=sms
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_HOST=127.0.0.1
DB_PORT=3306
```

### 4 — Run migrations and start Django

```bash
python manage.py migrate
python manage.py runserver
# API available at http://localhost:8000
```

### 5 — Frontend setup

```bash
cd ../frontend
npm install
npm run dev
# App available at http://localhost:5173
```

---

## 📁 Project Structure

```
sms-django-react/
├── backend/                    # Django application
│   ├── api/                    # Main app
│   │   ├── migrations/         # Database migrations
│   │   ├── management/         # Custom manage.py commands
│   │   ├── models.py           # 40+ Django models
│   │   ├── serializers.py      # DRF serializers
│   │   ├── views.py            # ViewSets (60+ endpoints)
│   │   ├── urls.py             # API router
│   │   ├── mixins.py           # EtablissementFilterMixin
│   │   ├── pagination.py       # Custom pagination
│   │   └── utils.py            # Helpers (audit log, IP)
│   ├── sms_backend/            # Django project config
│   │   ├── settings.py
│   │   └── urls.py
│   ├── requirements.txt
│   └── manage.py
│
├── frontend/                   # React + Vite application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── context/            # React context (App, Notifications)
│   │   ├── hooks/              # Custom hooks (useApi, useEtablissement…)
│   │   ├── i18n/               # FR / EN translation files
│   │   ├── layouts/            # Layout, Navbar, Sidebar
│   │   ├── pages/              # One component per page (25+ pages)
│   │   ├── routes/             # Protected route configuration
│   │   ├── services/           # Axios instance + endpoint helpers
│   │   ├── styles/             # Global CSS design system
│   │   └── utils/              # Auth helpers, role guards, etabLabels
│   ├── package.json
│   └── vite.config.js
│
├── docs/
│   └── ARCHITECTURE.md         # Models, endpoints, auth flow
├── scripts/                    # SQL migration / seed scripts
├── .gitignore
└── README.md
```

---

## 📐 Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a detailed description of the data models, API endpoints, and JWT authentication flow.

---

## 👤 Author

**Luc** — *[LuckyCifer](https://github.com/LuckyCifer)*

Built with ❤️ as part of the ISA academic programme and deployed in production at a real Cameroonian institution.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
