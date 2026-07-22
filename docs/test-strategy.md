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

| Risk                                | Why it matters                             | Coverage                                                                                           |
| ----------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Broken authorization                | Protected data or mutations exposed        | Authorization matrix over every protected endpoint                                                 |
| Double booking                      | Direct revenue/customer impact             | Overlap rejection asserted (`409`)                                                                 |
| Contract drift between services     | Report silently diverges from room/booking | Strict schemas + cross-service consistency test                                                    |
| A provider breaks its callers       | A working client stops working silently    | Pact contracts verified against the running providers ([contract-testing.md](contract-testing.md)) |
| Data-integrity gaps across services | Orphan records                             | Booking against a non-existent room ([BUG-005](bug-reports/BUG-005-booking-nonexistent-room.md))   |
| Information disclosure              | Internals and PII leaked to callers        | Validation-leak and inbox-exposure checks                                                          |

## Suite taxonomy

| Suite         | Network | Purpose                                                                                                                 | Command                    |
| ------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `unit`        | none    | Framework internals: config parsing, redaction, request building, error normalization, health mapping, schema assertion | `npm run test:unit`        |
| `smoke`       | live    | Behavioural happy paths and key negatives per service                                                                   | `npm run test:smoke`       |
| `contract`    | live    | Response schemas, drift detection, cross-service consistency                                                            | `npm run test:contract`    |
| `pact`        | none    | Consumer-driven contracts: what the client layer requires of auth, room and booking                                     | `npm run test:pact`        |
| `negative`    | live    | Credential rejection, authorization matrix, boundary and malformed input                                                | `npm run test:negative`    |
| `data-driven` | live    | Room and booking validation matrices driven by external JSON datasets                                                   | `npm run test:data-driven` |
| `property`    | live    | fast-check properties: payload round-trip, double-booking rejection, summary reflection                                 | `npm run test:property`    |
| `security`    | live    | OWASP-oriented: BFLA/IDOR authorization, token tampering, injection, mass-assignment, input handling                    | `npm run test:security`    |

`npm run test:live` runs all six live suites; `npm test` runs everything; `npm run coverage` adds enforced thresholds.

## Entry and exit criteria

**Entry** — all six services report `UP` on `/actuator/health`. The `globalSetup` gate polls until they do, up to `READINESS_TIMEOUT_MS`, then aborts with the failing service and the attempt count named.

**Exit** — static checks, unit tests and the full live suite with coverage thresholds all pass. Known platform defects are represented by `guardsDefect` tests, so the suite is green while a defect exists and turns red the moment it is fixed.

## Handling known defects

Every confirmed platform defect gets:

1. a report in [`docs/bug-reports/`](bug-reports/) with repro steps, evidence, impact and severity,
2. a `guardsDefect` test that encodes the **expected correct behaviour**.

This keeps defects visible instead of silently accommodated, and makes a platform fix surface immediately as a failing test rather than going unnoticed. Most guards are gated on `defects.documented` and run only against the target whose behaviour they document; the header findings (BUG-010, BUG-011) are deployment-specific and gated the same way.

### Why not `it.fails`

The guards were originally `it.fails`. That idiom inverts the outcome, so **any** failure satisfies it — including a transport timeout. A guard written to prove "the platform still returns the wrong status" also passed when the request never completed, which is a green result that proves nothing. It happened three times: [BUG-009](bug-reports/BUG-009-report-stalls-on-invalid-token.md) was found this way, a hung `POST /room` was later absorbed by the BUG-007 guard, and switching idiom immediately exposed a third — see below.

The replacement keeps the correct expectation in the test body and classifies the failure instead of inverting it:

```ts
guardsDefect('BUG-002', 'returns 404 for a deleted room', async () => {
  const response = await room.getById(created.roomid)

  expect(response.status).toBe(404)
})
```

`observeDefect` runs the body and looks at what came out:

| Outcome                      | Meaning                                        | Result                               |
| ---------------------------- | ---------------------------------------------- | ------------------------------------ |
| `AssertionError`             | the defect still reproduces                    | **pass**                             |
| nothing thrown               | the expectation now holds                      | **fail** — named, with the report id |
| `ApiError`, or anything else | the request never completed, or the test broke | **fail**                             |

So a timeout is a failure, an unexpected `TypeError` is a failure, and a platform fix is a failure that says which report to close. The correct behaviour stays written down as the assertion — the property that made `it.fails` attractive — while the outcome is no longer inverted.

Characterisation tests (`expect(status).toBe(500)`) were the other candidate. They fail on a timeout too, but they encode the wrong value as the expectation, and when the platform is fixed the assertion has to be rewritten rather than simply un-guarded. This approach keeps the expectation correct and still fails for the right reasons.

The report id is a required, typed argument, so a guard cannot be written without naming its report — and a unit test asserts both directions of parity: every report on disk is declared, and every declared report is guarded.

### Test timeout must exceed the client timeout

`testTimeout` was `30_000`, the same as `TIMEOUT_MS`. A request that hit the client timeout was killed by Vitest at the same instant, so the run reported `Test timed out in 30000ms` instead of the client's `ApiError: Request timed out: <url>` — the URL, the method and the attempt count were all lost. `testTimeout` is now `45_000`, above the client budget, and the two guards that talk to slow endpoints carry their own patient client with a test timeout above _that_. This is the same ordering the hook budget already follows.

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

### What the exchange log established about the "CI-only" failures

Setting `HTTP_LOG_FILE` writes one compact record per HTTP exchange — method, url, status, duration, attempt — and `npm run diagnose:exchanges` summarises it. CI writes the log on every live run and uploads it as an artifact when the job fails.

A local baseline over a full suite (549 exchanges) gave the reference profile:

| Host                         | Exchanges | p95        |
| ---------------------------- | --------- | ---------- |
| `automationintesting.online` | 440       | **168 ms** |
| loopback stubs (unit tests)  | 109       | ≤ 52 ms    |

Against the live host: **zero** transient responses (`408/425/429/502/503/504`) and no evidence of throttling. Two outliers stood out, both around 30 s:

1. `GET /report` → `500` after 31 382 ms — [BUG-009](bug-reports/BUG-009-report-stalls-on-invalid-token.md), already documented.
2. `POST /room` → **timed out at 30 015 ms** — the same shape as the failures previously believed to be CI-only.

The second one matters twice over. It reproduced **locally**, so the "CI-only" framing was wrong: this is platform latency that CI meets more often, not something specific to hosted runners. And the suite still reported **259/259 green** while it happened.

It could only hide in a test that treats a throw as success. Every other `room.create` call site is an ordinary test where a transport error fails the test; the one exception was the `it.fails` guard for BUG-007. **That guard passed because the request hung, not because the status was wrong** — the same false green [BUG-009](bug-reports/BUG-009-report-stalls-on-invalid-token.md) taught, in a second guard.

That was a limit of the `it.fails` idiom itself: it accepted _any_ failure, so it could not distinguish "the defect is still present" from "the request never completed". Timing evidence was the only thing that exposed it. The idiom has since been [replaced](#why-not-itfails), and the first live run under the replacement immediately turned up a third instance — the BUG-012 guard, which had never once observed the `500` it claimed to document.

## Targets

| Target  | Command              | Purpose                                                          |
| ------- | -------------------- | ---------------------------------------------------------------- |
| `live`  | `npm run test:live`  | The deployed platform — the target every defect report describes |
| `local` | `npm run test:local` | RBP `2.2` in Docker — offline, disposable, safe to mutate freely |

They run **different versions of the same API**, so expectations are declared per target in `src/profiles/target-profile.ts` rather than hard-coded ([inventory](target-differences.md)).

`local` is a development and exploration target, not a replacement for `live`: the defect guards document live's behaviour and are skipped elsewhere, so a green local run is not evidence about the deployed platform. CI gates on `live`.

### The local target runs nightly, not on pull requests

20 of the 140 tests skip against `local` — 16 defect guards plus 4 capability-gated assertions. Gating merges on a run with a seventh of its assertions switched off would trade a real signal for a fast one.

It is still worth running on a schedule, because its value is orthogonal to the PR gate: it detects the two targets **drifting further apart**, which is otherwise something we would only notice by accident. The `Local Target` workflow brings the stack up nightly, runs every live suite against it sequentially, and publishes its JUnit results under a separate artifact name so the two targets are never conflated. A failure means either the containers regressed or a new divergence appeared — the latter belongs in [target-differences.md](target-differences.md).

## CI strategy

| Trigger             | What runs                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Pull request / push | Static checks · Unit tests · Contract tests (Pact) · Tests & coverage (thresholds enforced) |
| Push to `main`      | Full suite + Allure report published to GitHub Pages                                        |
| Nightly 02:00 UTC   | Every live suite against the dockerized target — drift detection, not a merge gate          |
| Nightly 03:00 UTC   | Full suite against live platform; report republished; the run fails if the suite was red    |
| Daily 04:00 UTC     | OWASP ZAP baseline scan against the dockerized platform ([details](security-scan.md))       |
| Manual              | `Tests (manual)` workflow — any single suite or all together                                |

The three dockerized jobs are staggered an hour apart so they never contend for the same runner ports.

Static checks and unit tests run in parallel and gate the live job, so a broken build never reaches the shared environment.

## Reporting

Allure results are produced when `ALLURE=1`, rendered to HTML and published to [GitHub Pages](https://akogut.github.io/restful-booker-api-testing/). JUnit XML is emitted in CI for machine consumption. The report is published even when the suite is red — the workflow then fails explicitly, so triage material exists for every failure.

## Planned extensions

**k6 performance smoke** with latency and error-rate budgets, run nightly, is the one layer still outstanding ([M10](https://github.com/AKogut/restful-booker-api-testing/milestone/11)).

Everything else previously listed here has shipped: consumer-driven contracts with Pact ([contract-testing.md](contract-testing.md)), the OWASP-oriented security suite and ZAP baseline scan ([security-scan.md](security-scan.md)), and the dockerised target with its nightly drift run.

Two diagnostic threads stay deliberately open rather than being closed on a guess: [#67](https://github.com/AKogut/restful-booker-api-testing/issues/67), the unexplained `POST /room` stalls, and [#83](https://github.com/AKogut/restful-booker-api-testing/issues/83), the double slash in every local-target path.
