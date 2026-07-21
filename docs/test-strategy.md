# Test Strategy

## Objective

Verify the Restful Booker Platform API — six independent Spring Boot services — with a suite that is fast enough to gate every pull request, deterministic enough to trust on a shared public environment, and expressive enough to document real defects.

## Scope

| In scope                                                         | Out of scope                                     |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| REST contracts of auth, room, booking, message, branding, report | Web UI behaviour                                 |
| Authentication and authorization rules                           | Load and stress profiles (planned: k6)           |
| Business rules (availability, double-booking)                    | Database-level assertions                        |
| Response schemas and cross-service consistency                   | Third-party infrastructure (Cloudflare, Railway) |

## Risk-based prioritisation

| Risk                                | Why it matters                             | Coverage                                                                                         |
| ----------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Broken authorization                | Protected data or mutations exposed        | Authorization matrix over every protected endpoint                                               |
| Double booking                      | Direct revenue/customer impact             | Overlap rejection asserted (`409`)                                                               |
| Contract drift between services     | Report silently diverges from room/booking | Strict schemas + cross-service consistency test                                                  |
| Data-integrity gaps across services | Orphan records                             | Booking against a non-existent room ([BUG-005](bug-reports/BUG-005-booking-nonexistent-room.md)) |
| Information disclosure              | Internals and PII leaked to callers        | Validation-leak and inbox-exposure checks                                                        |

## Suite taxonomy

| Suite         | Network | Purpose                                                                                                                 | Command                    |
| ------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `unit`        | none    | Framework internals: config parsing, redaction, request building, error normalization, health mapping, schema assertion | `npm run test:unit`        |
| `smoke`       | live    | Behavioural happy paths and key negatives per service                                                                   | `npm run test:smoke`       |
| `contract`    | live    | Response schemas, drift detection, cross-service consistency                                                            | `npm run test:contract`    |
| `negative`    | live    | Credential rejection, authorization matrix, boundary and malformed input                                                | `npm run test:negative`    |
| `data-driven` | live    | Room and booking validation matrices driven by external JSON datasets                                                   | `npm run test:data-driven` |
| `property`    | live    | fast-check properties: payload round-trip, double-booking rejection, summary reflection                                 | `npm run test:property`    |

`npm run test:live` runs all five live suites; `npm test` runs everything; `npm run coverage` adds enforced thresholds.

## Entry and exit criteria

**Entry** — all six services report `UP` on `/actuator/health`. The `globalSetup` gate polls until they do, up to `READINESS_TIMEOUT_MS`, then aborts with the failing service and the attempt count named.

**Exit** — static checks, unit tests and the full live suite with coverage thresholds all pass. Known platform defects are represented by `it.fails` tests, so the suite is green while a defect exists and turns red the moment it is fixed.

## Handling known defects

Every confirmed platform defect gets:

1. a report in [`docs/bug-reports/`](bug-reports/) with repro steps, evidence, impact and severity,
2. an `it.fails` test that encodes the **expected correct behaviour**.

This keeps defects visible instead of silently accommodated, and makes a platform fix surface immediately as a failing test rather than going unnoticed. Report-to-test parity is intentional: nine reports, nine guards — ten test cases, since BUG-007 covers two endpoints. Every guard is gated on `defects.documented`, so it runs only against the target whose behaviour it documents.

An `it.fails` test is only as good as its failure reason. A guard that passes because the request timed out proves nothing about the defect it claims to cover, so any `it.fails` whose runtime approaches the client timeout is treated as suspect and re-examined — that is how [BUG-009](bug-reports/BUG-009-report-stalls-on-invalid-token.md) was found.

## Determinism on a shared environment

The target is a public demo mutated by other users at any time. The suite therefore:

- provisions its own room **per suite** rather than sharing a seeded one — a shared room would put every suite's bookings in one date space, which is the collision this design exists to avoid,
- generates non-overlapping booking windows by construction,
- asserts per-entity state instead of global counters,
- cleans up every created room, booking and message in `afterAll`, with a run-level registry sweeping anything a crashed suite left behind,
- never performs an irreversible mutation of shared state (for example, branding updates are only exercised where the request is rejected).

## Separating infrastructure noise from defects

A shared demo produces two kinds of red that must not be conflated:

| Signal                                               | Interpretation | Handling                                           |
| ---------------------------------------------------- | -------------- | -------------------------------------------------- |
| Cold start, `502/503/504`, `429`, connection refused | Infrastructure | Readiness gate + bounded retry with backoff        |
| `4xx` contract violation, `500`, wrong body          | Product defect | Fails the suite; documented in `docs/bug-reports/` |

Retries are deliberately narrow: idempotent methods only, transient statuses only, capped attempts, and disabled outright in the negative suites via `createServicesWithoutRetry()`. Every attempt is recorded in the exchange log, so a call that only passes on retry is visible rather than hidden — a retry policy that silently masks degradation would be worse than no retry at all.

## Targets

| Target  | Command              | Purpose                                                          |
| ------- | -------------------- | ---------------------------------------------------------------- |
| `live`  | `npm run test:live`  | The deployed platform — the target every defect report describes |
| `local` | `npm run test:local` | RBP `2.2` in Docker — offline, disposable, safe to mutate freely |

They run **different versions of the same API**, so expectations are declared per target in `src/profiles/target-profile.ts` rather than hard-coded ([inventory](target-differences.md)).

`local` is a development and exploration target, not a replacement for `live`: the defect guards document live's behaviour and are skipped elsewhere, so a green local run is not evidence about the deployed platform. CI gates on `live`.

## CI strategy

| Trigger             | What runs                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Pull request / push | Static checks · Unit tests · Tests & coverage (full suite, thresholds enforced)          |
| Push to `main`      | Full suite + Allure report published to GitHub Pages                                     |
| Nightly 03:00 UTC   | Full suite against live platform; report republished; the run fails if the suite was red |
| Manual              | `Tests (manual)` workflow — any single suite or all together                             |

Static checks and unit tests run in parallel and gate the live job, so a broken build never reaches the shared environment.

## Reporting

Allure results are produced when `ALLURE=1`, rendered to HTML and published to [GitHub Pages](https://akogut.github.io/restful-booker-api-testing/). JUnit XML is emitted in CI for machine consumption. The report is published even when the suite is red — the workflow then fails explicitly, so triage material exists for every failure.

## Planned extensions

Contract testing with Pact (consumer-driven contracts between report and its providers), OWASP-oriented security checks including a ZAP baseline scan, k6 performance smoke with latency and error-rate budgets, and a Dockerised platform target for fully deterministic runs.
