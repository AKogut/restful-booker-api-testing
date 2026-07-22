# restful-booker-api-testing

[![CI](https://github.com/AKogut/restful-booker-api-testing/actions/workflows/ci.yml/badge.svg)](https://github.com/AKogut/restful-booker-api-testing/actions/workflows/ci.yml)
[![Report](https://github.com/AKogut/restful-booker-api-testing/actions/workflows/report.yml/badge.svg)](https://github.com/AKogut/restful-booker-api-testing/actions/workflows/report.yml)
[![Security Scan](https://github.com/AKogut/restful-booker-api-testing/actions/workflows/security-scan.yml/badge.svg)](https://github.com/AKogut/restful-booker-api-testing/actions/workflows/security-scan.yml)
[![Allure report](https://img.shields.io/badge/Allure_report-live-brightgreen.svg)](https://akogut.github.io/restful-booker-api-testing/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-LTS-brightgreen.svg)](./.nvmrc)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](./tsconfig.json)

Production-grade API test automation framework for the [Restful Booker Platform](https://automationintesting.online/) — a Spring Boot **microservices** Bed & Breakfast booking system. Built to demonstrate a modular, maintainable, and CI-integrated approach to testing a multi-service API, including cross-service contract validation.

> **Status:** actively under construction. Work is tracked as milestones and issues on the [project board](https://github.com/users/AKogut/projects/15).

## System Under Test

The Restful Booker Platform is composed of independent services, each owning a slice of the domain:

| Service  | Port | Responsibility                   |
| -------- | ---- | -------------------------------- |
| auth     | 3004 | Issue, validate, destroy tokens  |
| room     | 3001 | Manage bookable rooms            |
| booking  | 3000 | Manage bookings and availability |
| message  | 3006 | Guest contact messages           |
| branding | 3002 | Site identity / branding         |
| report   | 3005 | Collate rooms and bookings       |

Each service exposes Swagger UI and an `/actuator/health` endpoint. Mutating operations are protected by a token issued by the auth service (default credentials: `admin` / `password`).

## Tech Stack

| Concern                | Choice                                    |
| ---------------------- | ----------------------------------------- |
| Language               | TypeScript (strict)                       |
| HTTP client            | Axios (wrapped in a typed `HttpClient`)   |
| Test runner            | Vitest                                    |
| Schema & contract      | Zod → JSON Schema                         |
| Consumer contracts     | Pact (pact-js) + dockerized Pact Broker   |
| Property-based testing | fast-check                                |
| Test data              | @faker-js/faker                           |
| Deterministic target   | Dockerized RBP via docker-compose         |
| Reporting              | Allure + JUnit, published to GitHub Pages |
| CI/CD                  | GitHub Actions                            |

## Architecture

A layered design keeps tests declarative and decoupled from transport and service topology:

```
src/
  config/     Typed, validated per-service configuration
  client/     HttpClient (Axios), request builder, token auth, error model
  models/     Domain types (Room, Booking, Message, Branding, Report, AuthToken)
  schemas/    Zod schemas and generated JSON Schema contracts
  services/   AuthService, RoomService, BookingService, MessageService,
              BrandingService, ReportService
  factories/  faker-based builders and fast-check arbitraries
  support/    session and provisioning helpers for suites
tests/
  unit/       Hermetic framework tests (no network)
  smoke/      Behavioural happy paths per service
  contract/   Schema, drift & cross-service consistency
  pact/       Consumer-driven contracts (hermetic, no platform needed)
  negative/   Auth, authorization, boundary, malformed input
  data-driven/ JSON-dataset driven room & booking matrices
  property/   fast-check property-based suites
  security/   OWASP-oriented authz, token & injection checks
  data/       External test-case datasets
docs/         Architecture, test strategy, bug reports
```

## Coverage

- **Auth** — login, validate, logout; negative and authorization paths
- **Room** — full CRUD
- **Booking** — create, get/list (by room), availability summary, update, delete
- **Message** — contact, list, read, delete, unread count
- **Branding / Report** — read/update branding; report consistency vs room + booking
- **Health** — `/actuator/health` gate across all services
- **Contract** — every response validated against its schema; cross-service consistency
- **Consumer contracts** — Pact contracts for auth, room and booking, verified against the running providers
- **Negative & data-driven** — authorization, boundary, malformed, table-driven, and property-based (incl. double-booking)
- **Security** — BFLA/IDOR authorization matrix, token tampering, header hygiene, secret non-leakage (OWASP API-oriented)

## Getting Started

```bash
nvm use
npm install
cp .env.example .env    # configure per-service URLs, credentials, TEST_MODE
npm test
```

## Scripts

| Script                  | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `npm test`              | Run the full suite                          |
| `npm run test:smoke`    | Fast smoke suite                            |
| `npm run test:unit`     | Hermetic unit tests                         |
| `npm run test:live`     | All six live suites against the platform    |
| `npm run coverage`      | Full suite with enforced thresholds         |
| `npm run test:local`    | Live suites against the Docker stack        |
| `npm run docker:up`     | Start the local RBP stack                   |
| `npm run docker:down`   | Stop it and drop volumes                    |
| `npm run test:contract` | Schema, drift & cross-service checks        |
| `npm run test:security` | OWASP-oriented authorization & token checks |
| `npm run test:pact`     | Generate the consumer pacts (no platform)   |
| `npm run pact:verify`   | Verify providers against the pacts          |
| `npm run typecheck`     | TypeScript type checking                    |
| `npm run lint`          | ESLint                                      |
| `npm run format`        | Prettier                                    |

## Contracts

Zod schemas in `src/schemas/` are the single source of truth for every service response. `npm run schema:export` renders them to language-agnostic JSON Schema files under `schemas/`. The `@contract` suite validates live responses against these schemas, detects drift (unexpected fields, malformed dates) via strict parsing, and asserts cross-service consistency (a booking surfaces in the room report).

On top of that, **Pact** contracts state what this framework's client layer requires of `auth`, `room` and `booking`, and CI replays them against the running services before a merge. Schemas describe a response that arrived; a pact describes a request that must keep working. See [docs/contract-testing.md](docs/contract-testing.md).

## Resilience

The platform is a shared public demo that cold-starts, so the framework treats transient failure as an expected condition rather than a test result:

- **Readiness gate** — `globalSetup` polls `/actuator/health` across all six services until they are `UP` or `READINESS_TIMEOUT_MS` elapses, so a cold start no longer reds an otherwise healthy pipeline.
- **Retry with backoff** — idempotent requests retry on `408/425/429/502/503/504` and transport failures, with exponential backoff and jitter. `POST` never retries, and `500` is treated as a real defect.
- **Observable** — every exchange log entry carries its `attempt`, so retried calls stay visible in the report.
- **Opt-out** — negative suites use `createServicesWithoutRetry()` so a failure assertion always observes the first response.

| Variable                | Default | Purpose                             |
| ----------------------- | ------- | ----------------------------------- |
| `RETRY_MAX_ATTEMPTS`    | `3`     | Attempts per idempotent request     |
| `RETRY_BASE_DELAY_MS`   | `300`   | First backoff delay                 |
| `RETRY_MAX_DELAY_MS`    | `3000`  | Backoff ceiling                     |
| `READINESS_TIMEOUT_MS`  | `90000` | Total wait for the platform to boot |
| `READINESS_INTERVAL_MS` | `3000`  | Interval between health polls       |

Set `RETRY_MAX_ATTEMPTS=1` and `READINESS_TIMEOUT_MS=0` to reproduce the pre-retry, fail-fast behaviour.

## Test Targets

The suite runs against two targets that implement **different versions of the same API**:

| Target  | Command              | What it is                                                    |
| ------- | -------------------- | ------------------------------------------------------------- |
| `live`  | `npm run test:live`  | The hosted platform at `automationintesting.online`           |
| `local` | `npm run test:local` | RBP `2.2` images via `docker compose`, offline and disposable |

```bash
cp .env.local.example .env.local
npm run docker:up      # start the six services
npm run test:local     # run every live suite against the container stack
npm run docker:down    # stop and remove volumes
```

The target is selected by `ENV_FILE`; each env file sets `TEST_MODE`, which drives the expectation profile.

### They are not the same API

The hosted platform runs code that is not in the open-source project — verified against the `2.2` images, the `latest` images and upstream `trunk` source, all three of which agree with each other and disagree with live. So the suite does not pretend one set of expectations fits both:

```ts
expect(response.status).toBe(expectedStatus('auth.rejected'))   // 401 live, 403 local
itWhenSupported('auth.tokenInBody')('returns the token in the body', …)
```

`src/profiles/target-profile.ts` holds every difference in one place. Full inventory, including why the defect guards are live-only, in [docs/target-differences.md](docs/target-differences.md).

## Writing a Test

Tests never touch HTTP. A service method returns a typed `ApiResponse<T>`, and a non-2xx is a value to assert rather than an exception to catch:

```ts
const { room } = createServices()

const response = await room.create(roomPayload(), token)

expect(response.status).toBe(expectedStatus('resource.created'))
```

Services are thin and declarative — the fluent builder carries the token, so a negative test is just the same call without one:

```ts
export class RoomService {
  async create(
    payload: RoomPayload,
    token?: string,
  ): Promise<ApiResponse<SuccessResponse | ErrorsResponse>> {
    return this.client.request(RequestBuilder.post('').withBody(payload).withToken(token).build())
  }
}
```

`withToken(undefined)` omits the header entirely, which is why `room.create(payload)` reads as "create without authenticating" instead of needing a separate code path.

### A cross-service test

The most valuable assertions span services — a booking created through one service must surface in another's report:

```ts
it('a booking created via BookingService is reflected in the room report', async () => {
  const response = await report.getByRoom(testRoom.roomid, token)
  const validated = assertValid(reportSchema, response.data)

  expect(validated.report).toContainEqual({
    start: testBooking.bookingdates.checkin,
    end: testBooking.bookingdates.checkout,
    title: 'Unavailable',
  })
})
```

`assertValid()` parses the response through its Zod schema before the assertion runs, so a shape change fails as a contract violation with a precise path — not as a confusing `undefined` three lines later.

### Guarding a known defect

A platform bug is encoded as the behaviour that _should_ happen. The suite stays green while the defect exists and turns red the moment it is fixed:

```ts
guardsDefect('BUG-002', 'returns 404 for a deleted room', async () => {
  const created = await createRoom(roomPayload())
  await room.delete(created.roomid, token)
  createdRoomIds.forget(created.roomid)

  const response = await room.getById(created.roomid)

  expect(response.status).toBe(404)
})
```

`guardsDefect` classifies the outcome rather than inverting it: a failed assertion means the defect still reproduces, a clean pass means it is fixed (and names the report to close), and **a timeout or any other error fails the test**. Its predecessor, `it.fails`, accepted any failure at all — so a request that never completed looked exactly like a defect still present. That cost three false greens before it was replaced ([why](docs/test-strategy.md#why-not-itfails)).

Each guard is paired with a written report in [docs/bug-reports/](docs/bug-reports/) — twelve reports, twelve guards, and a unit test asserting both directions of that parity.

## Defects Found

Twelve confirmed platform defects, each with reproduction steps, evidence and a guarding test:

| ID                                                                    | Defect                                                     | Severity |
| --------------------------------------------------------------------- | ---------------------------------------------------------- | -------- |
| [BUG-001](docs/bug-reports/BUG-001-token-survives-logout.md)          | Auth token remains valid after logout                      | Major    |
| [BUG-002](docs/bug-reports/BUG-002-deleted-room-returns-500.md)       | Fetching a deleted room returns 500 instead of 404         | Minor    |
| [BUG-003](docs/bug-reports/BUG-003-booking-update-leaks-internals.md) | Booking update errors leak internal implementation details | Major    |
| [BUG-004](docs/bug-reports/BUG-004-message-inbox-public.md)           | Message inbox is readable without authentication           | Major    |
| [BUG-005](docs/bug-reports/BUG-005-booking-nonexistent-room.md)       | A booking can be created for a non-existent room           | Major    |
| [BUG-006](docs/bug-reports/BUG-006-branding-not-round-trippable.md)   | Branding cannot be round-tripped                           | Minor    |
| [BUG-007](docs/bug-reports/BUG-007-invalid-token-returns-500.md)      | An invalid token returns 500 instead of 401                | Major    |
| [BUG-008](docs/bug-reports/BUG-008-summary-accepts-any-token.md)      | Booking summary accepts any non-empty token                | Major    |
| [BUG-009](docs/bug-reports/BUG-009-report-stalls-on-invalid-token.md) | Report stalls ~31 s before rejecting an invalid token      | Major    |
| [BUG-010](docs/bug-reports/BUG-010-infrastructure-headers-leak.md)    | Responses leak infrastructure details in headers           | Minor    |
| [BUG-011](docs/bug-reports/BUG-011-missing-security-headers.md)       | API responses carry no standard security headers           | Minor    |
| [BUG-012](docs/bug-reports/BUG-012-oversized-input-returns-500.md)    | Oversized string input returns 500 instead of 400          | Minor    |

## Reporting

- **JUnit** XML is produced by the CI pipeline for every run.
- **Allure** results are generated with `npm run test:report`; `npm run allure:generate` renders the HTML report (`npm run allure:open` to view it locally).
- The [Report workflow](.github/workflows/report.yml) runs the full suite, builds the Allure report and publishes it to **[GitHub Pages](https://akogut.github.io/restful-booker-api-testing/)** on every `main` build and on a nightly schedule (03:00 UTC), so the live report always reflects the latest run against the platform.

## Documentation

- [Architecture](docs/architecture.md) — layering, request flow, run lifecycle, retries
- [Test Strategy](docs/test-strategy.md) — scope, risk prioritisation, suite taxonomy, CI strategy
- [Target Differences](docs/target-differences.md) — live vs local, and why they are not the same API
- [Security Scan](docs/security-scan.md) — OWASP ZAP baseline in CI, and how it complements the security suite
- [Bug Reports](docs/bug-reports/) — twelve defects with evidence and guarding tests

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching model, commit conventions, and workflow.

## License

[MIT](LICENSE) © Andrii Kohut
