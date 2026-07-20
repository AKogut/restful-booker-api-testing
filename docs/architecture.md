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

`assertPlatformHealthy()` probes `/actuator/health` on all six services in parallel and fails fast with a precise message (`report=DOWN, message=UNREACHABLE`). It runs as a Vitest `globalSetup` gate whenever `HEALTHCHECK=1`, so live suites stop once with a clear cause instead of cascading into timeouts. Unit tests run without it and stay hermetic.

## Test data and isolation

The platform is a shared public demo, so suites never assume ownership of seed data:

- `provisionRoom()` creates a dedicated room per run, avoiding date collisions with other users' bookings.
- The booking factory hands out non-overlapping weekly windows by construction.
- Every suite tracks the ids it created and removes them in teardown.
- Assertions avoid globally shared counters (for example, message read state is verified per message rather than via the global unread count).

## Why Axios + Vitest

The portfolio already contains a Playwright-based UI framework. Building the API layer on Axios + Vitest demonstrates that the architecture — not a specific runner — carries the design: a typed transport wrapper, service objects, schema-driven contracts and CI reporting are all tool-agnostic concerns.
