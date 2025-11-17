# Async Job Processor

Node.js backend + worker that accepts HTTP job requests, queues them in RabbitMQ, persists state in Redis, retries transient failures, and optionally POSTs callbacks when done.

## Run with Docker

- Prereqs: Docker + Docker Compose.
- Start everything (RabbitMQ, Redis, backend on port 3000, worker): `docker-compose up --build -d`
- To stop: `docker-compose down`

## Run Locally (without containerizing app code)

- Running RabbitMQ and Redis. Quick option: `docker-compose up rabbitmq redis` to start only the dependencies. Or just pull and start rabbitmq:3-management-alpine & redis:7-alpine
- Install deps: `npm run install:all`
- Env vars (defaults shown): `RABBITMQ_URL=amqp://localhost:5672`, `REDIS_URL=redis://localhost:6379`
- Start backend (port 3000): `npm run start:backend`
- Start worker: `npm run start:worker`
- Or start both concurrently (deps must already be up): `npm start`

## API

Base URL: `http://localhost:3000`

### Create job

- Endpoint: `POST /api/jobs` (`backend/src/routes/jobs.js`)
- Purpose: enqueue an HTTP call with retries and optional callback.
- Request body (validated with Joi):
  - `targetUrl` (string, required, URI): destination to call
  - `method` (string, "GET"|"POST", default "GET")
  - `headers` (object, default `{}`)
  - `payload` (object|null, default `null`): sent as body for POST
  - `callbackUrl` (string, required, URI): will receive final result payload
  - `maxRetries` (int 0-10, default 3)
  - `retryDelay` (int ms 100-30000, default 1000)
- Example request:
  ```bash
  curl -X POST http://localhost:3000/api/jobs \
    -H "Content-Type: application/json" \
    -d '{
      "targetUrl": "https://httpbin.org/post",
      "method": "POST",
      "headers": { "Content-Type": "application/json" },
      "payload": { "hello": "world" },
      "callbackUrl": "https://example.com/callback",
      "maxRetries": 3,
      "retryDelay": 1000
    }'
  ```
- Response 202:
  ```json
  {
    "jobId": "uuid",
    "status": "queued",
    "message": "Job accepted for processing"
  }
  ```
- Errors: 400 validation failure; 500 if enqueue fails.

### Get job status

- Endpoint: `GET /api/job/:jobId`
- Purpose: fetch current job state and attempts.
- Path param: `jobId` from the create response.
- Example request:
  ```bash
  curl http://localhost:3000/api/job/<jobId>
  ```
- Response 200 (queued/in-progress):
  ```json
  {
    "status": "in_progress",
    "attempts": "0",
    "targetUrl": "https://httpbin.org/post",
    "method": "POST",
    "headers": { "Content-Type": "application/json" },
    "payload": { "hello": "world" },
    "callbackUrl": "https://example.com/callback",
    "maxRetries": "3",
    "retryDelay": "1000",
    "createdAt": "2024-05-18T12:00:00.000Z",
    "updatedAt": "2024-05-18T12:00:01.000Z",
    "attemptsLog": []
  }
  ```
- Response 200 (completed):
  ```json
  {
    "status": "completed",
    "attempts": "1",
    "targetUrl": "https://example.com/hook",
    "method": "POST",
    "headers": { "Content-Type": "application/json" },
    "payload": { "foo": "bar" },
    "callbackUrl": "https://your-app.com/callback",
    "maxRetries": "3",
    "retryDelay": "1000",
    "createdAt": "2024-05-18T12:00:00.000Z",
    "updatedAt": "2024-05-18T12:00:02.000Z",
    "lastResponse": { "ok": true },
    "error": "",
    "attemptsLog": [
      {
        "attempt": 1,
        "statusCode": 200,
        "success": true,
        "timestamp": "2024-05-18T12:00:02.000Z",
        "response": { "ok": true }
      }
    ]
  }
  ```

## Architecture

- Backend API (Express) validates incoming job payloads, writes initial job state to Redis, and enqueues messages to RabbitMQ.
- RabbitMQ (`request-queue`) decouples request intake from execution; messages are persisted and consumed by the worker.
- Worker consumes jobs, performs the outbound HTTP request with retries/backoff, logs every attempt to Redis, and updates final status. Optional HTTP callback is sent when done.
- Redis acts as the job state store (current status, attempt count, attempt logs, last response/error). TTL cleanup keeps data for 24h.

## Improvements / TODOs

- Add tests: unit tests for validation, retry strategy, and request processor; integration tests against a local RabbitMQ/Redis stack.
- Auth/rate limiting: protect the public POST endpoint and throttle abusive clients.
- Observability: structured logging, request/trace IDs, and metrics (prometheus) for queue depth, success rate, retry counts, latency.
- Configurability: support more HTTP methods, headers allowlist/blocklist, and per-job retry strategy (exponential/backoff with jitter already partial).
- Reliability: persist RabbitMQ queues as durable, consider dead-letter queues for exceeded retries, and idempotency keys to avoid duplicates.
- API ergonomics: more status fields (e.g., next retry ETA), pagination for attempt logs, and OpenAPI/Swagger docs.
- Security: validate header keys/values, sandbox callback targets to allowed domains, and redact sensitive data in logs/Redis.
