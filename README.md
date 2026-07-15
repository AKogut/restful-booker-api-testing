# restful-booker-api-testing

[![CI](https://github.com/AKogut/restful-booker-api-testing/actions/workflows/ci.yml/badge.svg)](https://github.com/AKogut/restful-booker-api-testing/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-LTS-brightgreen.svg)](./.nvmrc)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](./tsconfig.json)

Production-grade REST API test automation framework for the [Restful Booker](https://restful-booker.herokuapp.com/) API. Built to demonstrate a modular, maintainable, and CI-integrated approach to API quality engineering.

> **Status:** actively under construction. Work is tracked as milestones and issues on the [project board](https://github.com/users/AKogut/projects/15).

## Tech Stack

| Concern | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| HTTP client | Axios (wrapped in a typed `HttpClient`) |
| Test runner | Vitest |
| Schema & contract | Zod → JSON Schema |
| Property-based testing | fast-check |
| Test data | @faker-js/faker |
| Mock mode | Prism (OpenAPI-driven) |
| Reporting | Allure + JUnit, published to GitHub Pages |
| CI/CD | GitHub Actions |

## Architecture

A layered design keeps tests declarative and decoupled from transport details:

```
src/
  config/     Typed, validated environment configuration
  client/     HttpClient (Axios), request builder, error model
  models/     Domain types (Booking, AuthToken, ...)
  schemas/    Zod schemas and generated JSON Schema contracts
  services/   AuthService, BookingService (business-level API)
tests/
  smoke/      Fast happy-path checks
  regression/ Full functional coverage
  negative/   Auth, boundary, malformed input
  contract/   Schema & drift validation
docs/         Architecture, test strategy, bug reports
```

## Coverage

- **Auth** — token creation, negative auth paths
- **Bookings** — create, get (single + filtered list), full update (PUT), partial update (PATCH), delete
- **Health** — `/ping` readiness gate
- **Contract** — every response validated against its schema
- **Negative & data-driven** — boundary, malformed, table-driven, and property-based cases

## Getting Started

```bash
nvm use
npm install
cp .env.example .env   # configure BASE_URL, credentials, TEST_MODE
npm test
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm test` | Run the full suite |
| `npm run test:smoke` | Fast smoke suite |
| `npm run test:regression` | Full regression |
| `npm run test:contract` | Schema & contract checks |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Test Modes

- **live** — runs against the hosted Restful Booker instance
- **mock** — runs against a Prism mock server generated from the OpenAPI spec, for deterministic, offline-friendly runs

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
