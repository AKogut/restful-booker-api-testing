# restful-booker-api-testing

[![CI](https://github.com/AKogut/restful-booker-api-testing/actions/workflows/ci.yml/badge.svg)](https://github.com/AKogut/restful-booker-api-testing/actions/workflows/ci.yml)
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
  factories/  faker-based test data builders (rooms, bookings)
  support/    session and provisioning helpers for suites
tests/
  smoke/      Fast happy-path checks
  regression/ Full functional coverage
  negative/   Auth, authorization, boundary, malformed input
  contract/   Schema, drift & cross-service consistency
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
- **Negative & data-driven** — authorization, boundary, malformed, table-driven, and property-based (incl. double-booking)

## Getting Started

```bash
nvm use
npm install
cp .env.example .env    # configure per-service URLs, credentials, TEST_MODE
npm test
```

## Scripts

| Script                    | Purpose                              |
| ------------------------- | ------------------------------------ |
| `npm test`                | Run the full suite                   |
| `npm run test:smoke`      | Fast smoke suite                     |
| `npm run test:regression` | Full regression                      |
| `npm run test:contract`   | Schema, drift & cross-service checks |
| `npm run typecheck`       | TypeScript type checking             |
| `npm run lint`            | ESLint                               |
| `npm run format`          | Prettier                             |

## Test Modes

- **live** — runs against the hosted platform at `automationintesting.online`
- **local** — runs against a Dockerized RBP stack (`docker-compose`) for deterministic, offline-friendly, CI-ready runs

Select the mode via `TEST_MODE` in `.env`.

## Reporting

Allure and JUnit reports are produced in CI. The merged Allure report is published to GitHub Pages on every `main` build.

## Documentation

- [Architecture](docs/architecture.md)
- [Test Strategy](docs/test-strategy.md)
- [Bug Reports](docs/bug-reports/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching model, commit conventions, and workflow.

## License

[MIT](LICENSE) © Andrii Kohut
