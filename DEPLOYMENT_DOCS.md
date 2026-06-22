# BritLedger AI - Deployment & Architecture Documentation

## 1. How AI Services Work
BritLedger AI utilizes OpenAI (GPT-4o) and Anthropic models to perform financial reasoning and categorization. 
The AI service is orchestrated via the `ai_service.py` module. When a user uploads a receipt or an expense note, the system triggers the following flow:
1. **Extraction**: The file or text is parsed to extract key entities like date, amount, vendor, and raw description.
2. **Categorization & Reasoning**: The extracted data is sent to the LLM with a highly specific system prompt (found in `ai_service.py`) that includes the user's business context and standard UK bookkeeping categories (e.g., Software, Travel, Office).
3. **VAT & Deductibility Estimation**: The LLM analyzes the vendor and category to suggest whether the expense is tax-deductible and if VAT can be reclaimed.
4. **Validation**: The LLM responds in a structured JSON format, which is validated by FastAPI/Pydantic schemas. The user must confirm this suggestion before it is saved to the database. Fake expense generation and illegal tax manipulation are explicitly forbidden at the prompt level.

## 2. How Queues Work (Celery & Redis)
To ensure the API remains extremely fast and responsive, time-consuming operations are offloaded to background workers using Celery with Redis as the message broker.
1. **Redis Broker**: When a task (e.g., sending an invoice email, generating a heavy PDF report, or processing an AI receipt categorization) is requested, the API pushes a message to the Redis queue (`redis:6379/1`).
2. **Celery Workers**: Background worker processes (`docker-compose` spins these up) listen to the Redis queues. They pick up tasks asynchronously.
3. **Task Routing**: We utilize specific queues for different workloads. For example, AI tasks are routed to the `ai_tasks` queue, while email dispatching goes to the `emails` queue. This prevents a backlog of heavy AI processing from delaying urgent email deliveries.
4. **Resilience**: Failed tasks are automatically retried using exponential backoff, ensuring resilience against transient network failures (e.g., when the OpenAI or Stripe API is temporarily down).

## 3. How Frontend/Backend Communicate
1. **RESTful API**: The Next.js frontend communicates with the FastAPI backend exclusively via a robust REST API under the `/api/v1` prefix.
2. **Authentication**: All sensitive endpoints are secured using JSON Web Tokens (JWT). The user logs in via `/api/v1/auth/login`, receives a short-lived access token and a long-lived refresh token, and passes the access token in the `Authorization: Bearer <token>` header for subsequent requests.
3. **CORS**: Cross-Origin Resource Sharing is strictly configured in `app/core/config.py` to only allow requests from the designated frontend domains (`http://localhost:3000` in dev).
4. **Data Validation**: Every request and response payload is validated strictly against Pydantic schemas, guaranteeing that the frontend receives exactly the data structure it expects.
5. **Webhooks**: For external integrations (Stripe, PayPal), the external service calls our backend directly (`/api/v1/payments/stripe/webhook`). The backend updates the database, and the frontend can either poll for status updates or use Server-Sent Events/WebSockets for real-time notification.

## 4. How Deployment Works
The application uses a containerized, production-grade deployment strategy leveraging Docker and Docker Compose.
1. **Containerization**: 
   - `api`: The FastAPI backend running via Uvicorn/Gunicorn.
   - `worker`: Celery workers processing background jobs.
   - `postgres`: The PostgreSQL relational database (can be swapped for a managed DB like Neon in production).
   - `redis`: The Upstash/Redis instance for caching and Celery queues.
   - `nginx`: A reverse proxy that handles incoming traffic, SSL termination, and rate limiting.
2. **Environment Configuration**: Sensitive secrets (API keys for Stripe, PayPal, OpenAI, Resend, DB credentials) are injected securely via the `.env` file and mapped to `app/core/config.py`.
3. **Scaling**: Because the architecture is stateless, scaling is horizontal. You can spin up multiple `api` or `worker` containers. The Redis instance ensures that scheduled Celery beat tasks only execute once.
4. **CI/CD**: Deployment requires pulling the latest image, running Alembic database migrations (`alembic upgrade head`), and restarting the containers without downtime.
