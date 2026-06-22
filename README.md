# 🇬🇧 BritLedger AI — Backend API

> Production-ready AI Bookkeeping & Invoicing platform for UK businesses.  
> Built with **FastAPI · PostgreSQL · Redis · SQLAlchemy · Celery · Docker**

---

## 📁 Project Structure

```
BritLedger/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py          # Register, login, logout, refresh, forgot/reset password
│   │       ├── clients.py       # Client CRUD, balances, invoice history
│   │       ├── invoices.py      # Invoice CRUD, send, cancel, record payment
│   │       ├── quotations.py    # Quotation CRUD, send, convert to invoice
│   │       ├── bookkeeping.py   # Expenses, transactions, ledger
│   │       ├── vat.py           # VAT summary, records, current-quarter estimate
│   │       ├── reports.py       # P&L, revenue, expenses, yearly report
│   │       └── router.py        # Central router aggregator
│   ├── core/
│   │   ├── config.py            # Pydantic settings (env vars)
│   │   ├── database.py          # Async SQLAlchemy engine & session
│   │   ├── redis.py             # Redis client & cache helpers
│   │   ├── security.py          # JWT creation/validation, bcrypt
│   │   ├── logging.py           # Structured logging (structlog)
│   │   └── celery_app.py        # Celery application & beat schedule
│   ├── models/
│   │   ├── base.py              # UUID + timestamp mixin
│   │   ├── user.py              # User (roles, status, 2FA)
│   │   ├── client.py            # Client
│   │   ├── invoice.py           # Invoice + InvoiceItem
│   │   ├── quotation.py         # Quotation + QuotationItem
│   │   ├── payment.py           # Payment
│   │   ├── expense.py           # Expense (UK categories)
│   │   ├── transaction.py       # Transaction + LedgerEntry
│   │   ├── vat.py               # VATRecord
│   │   └── ai_log.py            # AILog
│   ├── schemas/
│   │   ├── common.py            # APIResponse, PaginatedResponse
│   │   ├── auth.py              # Auth request/response schemas
│   │   ├── client.py            # Client schemas + ClientBalances
│   │   ├── invoice.py           # Invoice schemas
│   │   ├── quotation.py         # Quotation schemas
│   │   └── finance.py           # Payment, Expense, VAT, Report schemas
│   ├── services/
│   │   ├── user_service.py      # Register, login, JWT, password mgmt
│   │   ├── client_service.py    # Client CRUD, balance calculations
│   │   ├── invoice_service.py   # Invoice engine (recurring, payments, VAT)
│   │   ├── quotation_service.py # Quotation engine, convert-to-invoice
│   │   ├── bookkeeping_service.py # Expenses, transactions, ledger, VAT
│   │   └── report_service.py   # P&L, revenue, expense, yearly reports
│   ├── middleware/
│   │   ├── security.py          # CSP, HSTS, XSS headers
│   │   └── logging.py           # Request ID + structured request logging
│   ├── tasks/
│   │   ├── email_tasks.py       # Send invoice/quotation/reminder emails
│   │   ├── invoice_tasks.py     # Recurring generation, overdue marking, PDF
│   │   ├── report_tasks.py      # Monthly report caching
│   │   └── ai_tasks.py          # AI expense categorisation
│   ├── dependencies.py          # JWT auth deps, role guards, pagination
│   └── main.py                  # App factory, middleware, exception handlers
├── alembic/
│   ├── env.py                   # Migration environment (auto-discovers models)
│   ├── script.py.mako           # Migration file template
│   └── versions/                # Generated migration files go here
├── nginx/
│   └── nginx.conf               # Reverse proxy with rate limiting & SSL
├── scripts/
│   └── init_db.sql              # PostgreSQL extensions & tuning
├── tests/
│   └── test_basic.py            # Integration tests
├── .env.example                 # Environment variable template
├── requirements.txt             # Python dependencies
├── Dockerfile                   # Multi-stage build (dev + production)
├── docker-compose.yml           # Full stack: API, Celery, Postgres, Redis, Nginx
├── alembic.ini                  # Alembic configuration
├── pytest.ini                   # Pytest async configuration
└── setup.cfg                    # Flake8, isort, mypy config
```

---

## 🚀 Quick Start

### 1. Clone & Configure

```bash
git clone https://github.com/yourorg/britledger-ai.git
cd britledger-ai
cp .env.example .env
# Edit .env — set your DB password, Redis password, SECRET_KEY, etc.
```

### 2. Start with Docker (Recommended)

```bash
docker-compose up --build -d
```

Services start on:
| Service | URL |
|---------|-----|
| FastAPI | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Flower (Celery) | http://localhost:5555 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### 3. Run Database Migrations

```bash
docker-compose exec api alembic upgrade head
```

Or locally:
```bash
alembic upgrade head
```

### 4. Local Development (without Docker)

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env            # Fill in your local credentials
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

---

## 🔐 Authentication

All protected endpoints require:
```
Authorization: Bearer <access_token>
```

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/register` | Create account |
| `POST /api/v1/auth/login` | Get JWT tokens |
| `POST /api/v1/auth/logout` | Revoke token |
| `POST /api/v1/auth/refresh` | Refresh access token |
| `POST /api/v1/auth/forgot-password` | Request reset email |
| `POST /api/v1/auth/reset-password` | Reset with token |
| `POST /api/v1/auth/change-password` | Change password |
| `GET  /api/v1/auth/me` | Get profile |
| `PUT  /api/v1/auth/me` | Update profile |

---

## 📋 API Endpoints Summary

### Clients
```
GET    /api/v1/clients                    List with search/filter
POST   /api/v1/clients                    Create
GET    /api/v1/clients/{id}               Get by ID
PUT    /api/v1/clients/{id}               Update
DELETE /api/v1/clients/{id}               Soft delete
GET    /api/v1/clients/{id}/balances      Outstanding balance snapshot
GET    /api/v1/clients/{id}/invoices      Invoice history
```

### Invoices
```
GET    /api/v1/invoices                   List (filter: status, client, date, search)
POST   /api/v1/invoices                   Create
GET    /api/v1/invoices/{id}              Get with line items
PUT    /api/v1/invoices/{id}              Update draft/sent
POST   /api/v1/invoices/{id}/send         Send to client
POST   /api/v1/invoices/{id}/cancel       Cancel
POST   /api/v1/invoices/{id}/payments     Record payment (partial supported)
```

### Quotations
```
GET    /api/v1/quotations                 List
POST   /api/v1/quotations                 Create
GET    /api/v1/quotations/{id}            Get
PUT    /api/v1/quotations/{id}            Update
POST   /api/v1/quotations/{id}/send       Send
POST   /api/v1/quotations/{id}/convert    Convert to Invoice
```

### Bookkeeping
```
GET    /api/v1/bookkeeping/expenses       List (filter: category, date, search)
POST   /api/v1/bookkeeping/expenses       Create (auto-creates ledger + transaction)
GET    /api/v1/bookkeeping/expenses/{id}  Get
PUT    /api/v1/bookkeeping/expenses/{id}  Update
DELETE /api/v1/bookkeeping/expenses/{id}  Delete
GET    /api/v1/bookkeeping/transactions   Transaction search
GET    /api/v1/bookkeeping/ledger         Ledger history
```

### VAT
```
GET    /api/v1/vat/summary                VAT summary (boxes 1-7) for date range
GET    /api/v1/vat/records                All VAT records
GET    /api/v1/vat/report                 Current quarter estimate
```

### Reports
```
GET    /api/v1/reports/profit-loss        P&L for date range
GET    /api/v1/reports/revenue            Revenue summary
GET    /api/v1/reports/expenses           Expense breakdown by category/month
GET    /api/v1/reports/yearly/{year}      Full yearly report (P&L + VAT)

### Payments
GET    /api/v1/payments/settings          Get payment configuration (Admin)
POST   /api/v1/payments/settings          Update Stripe/PayPal/Bank settings
POST   /api/v1/payments/create-session    Create Stripe/PayPal checkout session
POST   /api/v1/webhooks/stripe            Stripe webhook handler
POST   /api/v1/webhooks/paypal            PayPal webhook handler
```

---

## 🔒 Security Features

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt via passlib |
| JWT tokens | Access (30min) + Refresh (7 days) |
| Token revocation | Redis blacklist |
| Rate limiting | slowapi (60 req/min default, 5 req/min auth) |
| SQL injection | SQLAlchemy ORM (parameterised queries) |
| XSS protection | Security headers middleware |
| CSRF | SameSite cookies + Origin validation |
| Security headers | CSP, HSTS, X-Frame-Options, X-XSS-Protection |
| Role-based access | SUPERADMIN, ADMIN, ACCOUNTANT, VIEWER |
| Input validation | Pydantic v2 with field validators |

---

## ⚙️ Key Environment Variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing key (min 32 chars) |
| `DATABASE_URL` | PostgreSQL async connection string |
| `REDIS_URL` | Redis connection string |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `MAIL_USERNAME` | SMTP email credentials |
| `RESEND_API_KEY` | Resend API key for branded emails |
| `ENCRYPTION_KEY` | Key for encrypting sensitive DB fields |
| `SENTRY_DSN` | Error monitoring (production) |
| `DEFAULT_VAT_RATE` | Default UK VAT rate (20.0) |

Full reference: see `.env.example`

---

## 🧪 Testing

```bash
pytest tests/ -v --cov=app --cov-report=term-missing
```

---

## 📦 Background Tasks (Celery)

| Task | Schedule | Queue |
|------|----------|-------|
| Generate recurring invoices | Every hour | default |
| Mark overdue + send reminders | Daily | default |
| Send invoice emails | On demand | emails |
| Generate PDF | On demand | default |
| AI expense categorisation | On demand | ai_tasks |
| Cache monthly reports | On demand | reports |

Monitor via Flower: http://localhost:5555

---

## 🗄️ Database Schema

11 tables: `users` · `clients` · `invoices` · `invoice_items` · `quotations` · `quotation_items` · `payments` · `expenses` · `transactions` · `ledger_entries` · `vat_records` · `ai_logs`

Run migrations:
```bash
alembic upgrade head
```

Generate a new migration after model changes:
```bash
alembic revision --autogenerate -m "description"
```

---

## 📄 Licence

Proprietary — © 2025 BritLedger AI. All rights reserved.
