# Architecture

## System Under Test

The [Restful Booker Platform](https://automationintesting.online/) is a Spring Boot microservices Bed & Breakfast system. Each service owns a slice of the domain and is reachable behind a single gateway under `/api/*`:

```
                     ┌──────────────┐
                     │     auth     │  issues / validates / destroys tokens
                     └──────┬───────┘
                            │ token (Cookie: token=…)
        ┌───────────┬───────┴────┬────────────┬────────────┐
        ▼           ▼            ▼            ▼            ▼
   ┌────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌────────┐
   │  room  │  │ booking │  │ message │  │ branding │  │ report │
   └────┬───┘  └────┬────┘  └─────────┘  └──────────┘  └───┬────┘
        │           │                                      │
        └───────────┴──────────────────────────────────────┘
              report aggregates rooms + bookings
```

Every service exposes Swagger UI and `/actuator/health`. Mutating operations require a token issued by `auth`.

## Framework Layers

The framework is layered so that a test never touches HTTP concerns and a service never knows about assertions.

```
tests/                     specifications only
  unit/                    hermetic, no network
  smoke/                   behavioural happy paths + key negatives
  contract/                schema, drift and cross-service consistency
  negative/                auth, authorization, boundary, malformed

src/
  config/                  env parsing + validation → typed AppConfig
  client/                  HttpClient (Axios), RequestBuilder, ApiError, redacting logger
  services/                AuthService, RoomService, BookingService,
                           MessageService, BrandingService, ReportService
  schemas/                 Zod schemas (source of truth) + assertValid + registry
  models/                  TypeScript domain types
  health/                  cross-service /actuator/health gate
  factories/               faker-based test data builders
  support/                 session and provisioning helpers
```

### Request flow

```
test → service method → RequestBuilder → HttpClient → Axios → RBP service
                                              │
                                              ├── request interceptor: correlation id + timing
                                              └── response interceptor: redacted structured log
                                                        │
test ← typed ApiResponse<T> ← normalized result ────────┘
                     │
                     └── ApiError on timeout / network failure
```

Key properties:

- **Non-2xx never throws.** `validateStatus: () => true` means negative cases are asserted, not caught. Only transport failures raise `ApiError`.
- **Secrets never leak.** Redaction runs before any logger sees the exchange, including JSON-serialized bodies.
- **One client per service.** `createServices()` builds an `HttpClient` per service base URL from config, so "which service" is resolved by construction rather than by string paths in tests.

## Contracts

Zod schemas in `src/schemas/` are the single source of truth for response shapes. They are:

1. asserted at runtime by the `@contract` suite via `assertValid()`,
2. exported to language-agnostic JSON Schema under `schemas/` with `npm run schema:export`.

Schemas are `.strict()`, so an unexpected field is a failure — that is what makes drift detection meaningful.

## Environment readiness

`checkHealth()` probes `/actuator/health` on all six services in parallel and reports each as `UP`, `DOWN` or `UNREACHABLE`.

`waitForPlatformReady()` runs as a Vitest `globalSetup` gate whenever `HEALTHCHECK=1`. It polls that probe every `READINESS_INTERVAL_MS` until every service is `UP` or `READINESS_TIMEOUT_MS` elapses, printing the unhealthy set on each poll. The public demo cold-starts, so a single probe would fail an otherwise healthy pipeline; a bounded wait absorbs the cold start while still failing fast — and with a precise cause — when the platform is genuinely down:

```
Restful Booker Platform is not ready after 30 attempts within 90000 ms — auth=UNREACHABLE
```

Unit tests skip the gate entirely and stay hermetic.

## Retries

Transport-level retries are a property of the client, not of individual tests:

- **Idempotent methods only** — `GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`. A retried `POST` could create a duplicate booking, so it never retries.
- **Transient signals only** — `408`, `425`, `429`, `502`, `503`, `504`, plus timeouts and connection failures. `500` is excluded on purpose: on this platform it is a genuine application defect worth failing on, not infrastructure noise.
- **Exponential backoff with jitter** — `baseDelayMs · 2^(attempt-1)`, capped at `maxDelayMs`, randomized across the upper half so parallel suites do not resynchronize.
- **Observable** — every exchange log entry carries its `attempt`, so a passing-but-flaky endpoint is visible in the report rather than silently smoothed over.
- **Opt-out** — negative suites build their services through `createServicesWithoutRetry()`. A suite that asserts failure must observe the first response, not a masked one.

## Two targets, one suite

The suite runs against the hosted platform (`live`) and against the published RBP images in `docker compose` (`local`). These implement **different versions of the same API** — verified against the `2.2` images, the `latest` images and upstream `trunk` source, which agree with each other and disagree with live.

Rather than maintain two suites or assert the lowest common denominator, differences are declared in one module:

```
src/profiles/target-profile.ts
  STATUS        expectedStatus('auth.rejected')   → 401 live, 403 local
  CAPABILITIES  supports('auth.tokenInBody')      → gates version-specific assertions
```

The layering rule that makes this cheap: **adapt at acquisition, assert at contract.** Obtaining a token or a created booking is plumbing, so helpers (`extractToken`, `createdBooking`, `validationMessages`) accept either shape. The exact response body _is_ the contract, so those assertions are gated by capability and skipped where they do not apply — visibly, as skips in the report, never silently softened.

Because `createServices()` already builds one client per service base URL, pointing at a different deployment costs a config file and no code:

```
live:  https://automationintesting.online/api/room
local: http://localhost:3001/room/
```

The full inventory of differences is in [target-differences.md](target-differences.md).

## Run lifecycle

`tests/global-setup.ts` owns everything that is true once per run rather than once per suite:

```
readiness gate  →  wait for all six services (see above)
token warm-up   →  one admin login, published via project.provide('adminToken')
run registry    →  a temp JSONL file whose path is exported as RUN_REGISTRY
                   ↓  (suites run)
teardown        →  sweep anything the suites left behind, then delete the file
```

Suites take the token synchronously with `sharedToken()` instead of logging in themselves, which took a full run from **21 logins to 12** — the remaining twelve belong to the auth suite and the login-negative matrix, where logging in _is_ the test subject.

### The registry is a crash net, not the cleanup path

Every suite still deletes what it created in `afterAll`; that is the fast path and it stays. The registry exists for the case `afterAll` never runs — a failed `beforeAll`, a timeout, a killed worker. `track()` appends to a file rather than an in-memory set precisely because the worker that created the resource may be the one that died, and the file survives it.

Teardown is silent when the suites cleaned up after themselves, and reports only what it actually removed:

```
Swept 1 resource(s) left behind by an incomplete suite
```

Verified by deliberately running a suite that provisions a room and never cleans up: the run failed and the sweep removed the room. Untested cleanup infrastructure is worth very little, since it only ever runs on the paths nobody exercises.

## Test data and isolation

The platform is a shared public demo, so suites never assume ownership of seed data:

- `provisionRoom()` creates a dedicated room per run, avoiding date collisions with other users' bookings.
- The booking factory hands out non-overlapping weekly windows by construction.
- Every suite tracks the ids it created and removes them in teardown.
- Assertions avoid globally shared counters (for example, message read state is verified per message rather than via the global unread count).

## Why Axios + Vitest

The portfolio already contains a Playwright-based UI framework. Building the API layer on Axios + Vitest demonstrates that the architecture — not a specific runner — carries the design: a typed transport wrapper, service objects, schema-driven contracts and CI reporting are all tool-agnostic concerns.
