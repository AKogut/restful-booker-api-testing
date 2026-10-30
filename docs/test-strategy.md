# Test Strategy

## Objective

Verify the Restful Booker Platform API — six independent Spring Boot services — with a suite that is fast enough to gate every pull request, deterministic enough to trust on a shared public environment, and expressive enough to document real defects.

## Scope

| In scope                                                         | Out of scope                                     |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| REST contracts of auth, room, booking, message, branding, report | Web UI behaviour                                 |
| Authentication and authorization rules                           | Database-level assertions                        |
| Business rules (availability, double-booking)                    | Third-party infrastructure (Cloudflare, Railway) |
| Response schemas and cross-service consistency                   | Sustained stress/soak profiles                   |
| Latency and error-rate budgets under load (k6 smoke)             |                                                  |

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
| `perf`        | docker  | k6 smoke load on the booking flow; p95-latency and error-rate budgets enforced as thresholds                            | `npm run perf:smoke`       |

`npm run test:live` runs all six live suites; `npm test` runs everything; `npm run coverage` adds enforced thresholds.

## Entry and exit criteria

**Entry** — all six services report `UP` on `/actuator/health`. The `globalSetup` gate polls until they do, up to `READINESS_TIMEOUT_MS`, then aborts with the failing service and the attempt count named.

**Exit** — static checks, unit tests and the full live suite with coverage thresholds all pass. Known platform defects are represented by `guardsDefect` tests, so the suite is green while a defect exists and turns red the moment it is fixed.

## Handling known defects

Every confirmed platform defect gets:

1. a report in [`docs/bug-reports/`](bug-reports/) with repro steps, evidence, impact and severity,
2. a `guardsDefect` test that encodes the **expected correct behaviour**.

This keeps defects visible instead of silently accommodated, and makes a platform fix surface immediately as a failing test rather than going unnoticed. Every guard is gated on `defects.documented` and runs only against the target whose behaviour it documents — including the header findings (BUG-010, BUG-011), which are specific to the deployment.

### Why not `it.fails`

The guards were originally `it.fails`. That idiom inverts the outcome, so **any** failure satisfies it — including a transport timeout. A guard written to prove "the platform still returns the wrong status" also passed when the request never completed, which is a green result that proves nothing. It happened three times: [BUG-009](bug-reports/BUG-009-report-stalls-on-invalid-token.md) was found this way, a hung `POST /room` was later absorbed by the BUG-007 guard, and switching idiom immediately exposed a third — see below.

The replacement keeps the correct expectation in the test and classifies the failure instead of inverting it. A guard has two parts: `reproduce` performs the setup and the call under test, and `expectCorrect` asserts the behaviour the platform should have:

```ts
guardsDefect('BUG-002', 'returns 404 for a deleted room', {
  reproduce: async () => {
    const created = await createRoom(roomPayload())
    const deletion = await room.delete(created.roomid, token)
    expect(deletion.status).toBe(202)
    createdRoomIds.forget(created.roomid)

    return room.getById(created.roomid)
  },
  expectCorrect: (response) => {
    expect(response.status).toBe(404)
  },
})
```

`observeDefect` runs the two parts and looks at what came out:

| Outcome                                       | Meaning                                         | Result                               |
| --------------------------------------------- | ----------------------------------------------- | ------------------------------------ |
| `AssertionError` from `expectCorrect`         | the defect still reproduces                     | **pass**                             |
| nothing thrown                                | the expectation now holds                       | **fail** — named, with the report id |
| anything thrown by `reproduce`                | the setup broke, so the defect was not observed | **fail**                             |
| `ApiError` or any other error from either one | the request never completed, or the test broke  | **fail**                             |

So a timeout is a failure, an unexpected `TypeError` is a failure, and a platform fix is a failure that says which report to close. The split matters as much as the classification. When the body was a single function, a failed setup assertion (a room that was not created, a delete that did not succeed) was also an `AssertionError`, and it passed as "defect still present" without the defect ever being reached. Only `expectCorrect` can now make a guard pass. The correct behaviour stays written down as the assertion — the property that made `it.fails` attractive — while the outcome is no longer inverted.

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
- never performs an irreversible mutation of shared state (for example, branding is only written back with its own current values, or in a request that is rejected).

## Separating infrastructure noise from defects

A shared demo produces two kinds of red that must not be conflated:

| Signal                                               | Interpretation | Handling                                                                |
| ---------------------------------------------------- | -------------- | ----------------------------------------------------------------------- |
| Cold start, `502/503/504`, `429`, connection refused | Infrastructure | Readiness gate + bounded retry with backoff                             |
| Scheduled database reset wipes a suite's fixtures    | Infrastructure | Reset canaries + one proven retry ([below](#scheduled-database-resets)) |
| `4xx` contract violation, `500`, wrong body          | Product defect | Fails the suite; documented in `docs/bug-reports/`                      |

Retries are deliberately narrow: idempotent methods only, transient statuses only, capped attempts, and disabled outright in the negative suites via `createServicesWithoutRetry()`. Every attempt is recorded in the exchange log, so a call that only passes on retry is visible rather than hidden — a retry policy that silently masks degradation would be worse than no retry at all.

### Recovering a revoked admin session

The live platform occasionally stops accepting the run's shared admin token part-way through a run ([#134](https://github.com/AKogut/restful-booker-api-testing/issues/134)): authenticated calls start returning `403`, `POST /room` returns `500`, fresh logins still succeed, and every suite that follows fails for a reason unrelated to what it tests. The trigger turned out to be the platform's own schedule rather than overlapping live runs: the auth service wipes its database every ten minutes, and every token it issued goes with it ([Scheduled database resets](#scheduled-database-resets)).

`AdminSession` handles it narrowly. When a request carrying **the shared token** is answered with `401`, `403` or `500`, it asks the platform whether that token is still valid:

- still valid → the response was genuine and is returned unchanged; nothing is replayed,
- no longer valid → it logs in once, replays that request once with the new token, and every later request in the worker sends the new token up front.

It never touches a token a test chose itself — the invalid, tampered and logged-out tokens the negative and security suites send are compared against the shared token and ignored, so no authorization assertion can be satisfied by a renewal. Concurrent rejections share one login. If the check itself fails in transit — which happened on a slow `500` from the BUG-012 path, where the platform dropped the follow-up `validate` — the original response is returned with a warning rather than turning a genuine answer into a transport error. Each renewal prints a warning, and the replayed exchange carries `sessionRenewed: true` in the exchange log, which `npm run diagnose:exchanges` counts — a run that needed it says so.

### Scheduled database resets

Every RBP service carries a `DatabaseScheduler`. When its `dbRefresh` variable is set to `N`, the service drops and re-seeds its database every `N` minutes, on its own timer, and its id sequence starts again from the seed. The dockerized target in this repository does not set it. The live demo does.

A canary probe on 20 October 2026 measured the schedule by planting one room, one booking and one message and polling them every 15 seconds:

| Service | Wiped at (UTC)     | Signal                                              |
| ------- | ------------------ | --------------------------------------------------- |
| booking | 14:34:37, 14:44:37 | canary booking `404`; the next booking id was lower |
| auth    | 14:34:37, 14:44:37 | the shared token answered `403` in the same poll    |
| room    | 14:38:13, 14:48:12 | canary room gone; the new room reused id `4`        |
| message | 14:39:14           | canary message missing from the inbox               |

So each database is wiped every ten minutes, at its own offset. Anything a suite created before its database was wiped is gone afterwards: a booking read answers `404`, a room read answers `500` ([BUG-002](bug-reports/BUG-002-deleted-room-returns-500.md)), a message drops out of the inbox, and the room report comes back empty. A property test that hits the wipe keeps shrinking against an empty database until `testTimeout` kills it, which hides the real assertion behind a timeout.

That is the signature of the live reds that kept appearing after the session recovery landed. Where the run logs time-stamp the failing test, they read 08:58, 08:59, 09:38, 09:44, 07:44 and 12:18 UTC, on six different days: minutes 4, 8 and 9 past a ten-minute mark, the minutes the probe measured for booking, room and message. The auth wipe is also what [#134](https://github.com/AKogut/restful-booker-api-testing/issues/134) was chasing.

The suite cannot stop the platform from wiping itself, so it makes a wipe provable and recovers from it once:

- **Canaries.** Every live test file plants one room, one booking and one message before its fixtures, and never touches them again. A canary that disappears proves its database was wiped. A failed or unexpected read proves nothing.
- **One proven retry.** Live runs allow one retry per test. Before the retry, the gate checks the canaries. With no canary gone, the retry fails at once with `Not retried: no platform database reset was detected…`, next to the original error, so a genuine failure reads exactly as before. With one gone, the file's fixtures are provisioned again through `establishFixtures()` and the test runs once more.
- **Visible.** Every granted retry prints which database was wiped and which test it affected, and the run ends with a summary:

  ```
  Retried 1 test(s) once after the platform reset its booking database mid-run:
    - tests/smoke/bookings.test.ts > updates a booking and persists the changes
  ```

- **Bounded.** Unit and Pact files are never retried. Property tests stop at the first counterexample (`endOnFailure`) instead of shrinking against a database that is about to be wiped again.

Both paths were checked against the live demo. A test failing for an ordinary reason was refused its retry and reported both errors. A test holding a booking across the real 14:44:37 wipe failed its first attempt with `404`. The gate found the booking canary gone, re-provisioned the fixtures and retried, and the retry passed. A full `test:live` run started at 14:47:55 then met the 14:48:12 room wipe inside `denies room.delete to a caller with an invalid token without changing the target`, the authorization test behind most of the historical reds. It finished 144/144 on one proven retry, where it would previously have failed.

One limit is deliberate. The gate grants a retry when any watched database was wiped since the file started, not only the one the failing test touched. A genuinely intermittent defect that coincides with a wipe in the same file could therefore pass on the retry. The warning and the run summary name every such retry, so it cannot pass unseen.

### What the exchange log established about the "CI-only" failures

Setting `HTTP_LOG_FILE` writes one compact record per HTTP exchange — method, url, status, duration, attempt — and `npm run diagnose:exchanges` summarises it. The live job in CI and the nightly Local Target run both write the log, and upload it as an artifact when the suite fails.

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

### How the CI-only room failures resolved (#67)

The original signature — `POST /room` **create** returning `500` in CI while green locally — was traced to the room service rejecting the token CI had obtained, under the burst of **21 logins per run** (one `adminToken()` per test file). The shared-token change removed that burst: `globalSetup` performs one login per run and every suite takes it via `sharedToken()`. The create-`500` has not recurred in 30 subsequent `main` runs, and a bounded live measurement of 25 sequential creates returned `200` every time at a 0.23 s maximum — the normal write path is neither slow nor flaky. The ~31 s slow-`500` measured along the way was the oversized-`description` path ([BUG-012](bug-reports/BUG-012-oversized-input-returns-500.md)), a distinct pathological input, not ordinary creation.

The CI reds that remained at the time were put down to a `GET` on a room another suite deleted mid-test returning `500` ([BUG-002](bug-reports/BUG-002-deleted-room-returns-500.md)), plus the occasional transient connection blip the readiness gate and retry absorb. **Corrected on 20 October 2026:** no suite was deleting another suite's room. The room service wipes its own database every ten minutes ([Scheduled database resets](#scheduled-database-resets)), and BUG-002 is only why the vanished room surfaced as a `500` rather than a `404`. [#67](https://github.com/AKogut/restful-booker-api-testing/issues/67) is closed on that evidence — and if the signature ever returns, the exchange log now uploaded on failure and the raised `testTimeout` mean it will name its own cause.

## Targets

| Target  | Command              | Purpose                                                          |
| ------- | -------------------- | ---------------------------------------------------------------- |
| `live`  | `npm run test:live`  | The deployed platform — the target every defect report describes |
| `local` | `npm run test:local` | RBP `2.2` in Docker — offline, disposable, safe to mutate freely |

They run **different versions of the same API**, so expectations are declared per target in `src/profiles/target-profile.ts` rather than hard-coded ([inventory](target-differences.md)).

`local` is a development and exploration target, not a replacement for `live`: the defect guards document live's behaviour and are skipped elsewhere, so a green local run is not evidence about the deployed platform. CI gates on `live`.

### The local target runs nightly, not on pull requests

20 of the 144 tests skip against `local` — 16 defect-guard instances (the twelve guards, some fanned out over headers or endpoints) plus 4 capability-gated assertions. Gating merges on a run with a seventh of its assertions switched off would trade a real signal for a fast one.

It is still worth running on a schedule, because its value is orthogonal to the PR gate: it detects the two targets **drifting further apart**, which is otherwise something we would only notice by accident. The `Local Target` workflow brings the stack up nightly, runs every live suite against it sequentially, and publishes its JUnit results under a separate artifact name so the two targets are never conflated. A failure means either the containers regressed or a new divergence appeared — the latter belongs in [target-differences.md](target-differences.md).

**One exception: an outage of the hosted platform.** `Tests & coverage` checks the hosted platform's health endpoints first. When they do not answer, it runs the suite against the dockerized target instead, raises a warning and names the target in the job summary. The platform is a public demo this project does not run, and an outage there would otherwise block every merge until it ends. A fallback run is the weaker evidence described above, and the nightly report against live keeps failing until the platform is back.

## CI strategy

| Trigger             | What runs                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull request / push | Static checks · Unit tests · Contract tests (Pact) · Tests & coverage (thresholds enforced; against the dockerized target while live is down) |
| Push to `main`      | Full suite + Allure report published to GitHub Pages                                                                                          |
| Nightly 02:00 UTC   | Every live suite against the dockerized target — drift detection, not a merge gate                                                            |
| Nightly 03:00 UTC   | Full suite against live platform; report republished; the run fails if the suite was red                                                      |
| Daily 04:00 UTC     | OWASP ZAP baseline scan against the dockerized platform ([details](security-scan.md))                                                         |
| Nightly 05:00 UTC   | k6 smoke load against the dockerized target; fails on a budget breach ([details](../perf/README.md))                                          |
| Manual              | `Tests (manual)` workflow — any single suite or all together                                                                                  |

The three dockerized jobs — drift (02:00), ZAP (04:00) and k6 (05:00) — are staggered an hour apart so they never contend for the same runner ports. The 03:00 report job runs against the hosted platform and shares nothing with them.

Static checks and unit tests run in parallel and gate the live job, so a broken build never reaches the shared environment.

## Reporting

Allure results are produced when `ALLURE=1`, rendered to HTML and published to [GitHub Pages](https://akogut.github.io/restful-booker-api-testing/). JUnit XML is emitted in CI for machine consumption. The report is published even when the suite is red — the workflow then fails explicitly, so triage material exists for every failure.

## Performance

The functional suites assert correctness; they say nothing about behaviour under concurrent load. A [k6](https://k6.io) smoke fills that gap: a ramping-VU profile over the booking flow (room list, booking create, booking list) with p95-latency and error-rate budgets enforced as thresholds, so a regression exits non-zero and fails the nightly run. It runs against the **dockerized** target — load-testing writes against the shared public demo would pollute an environment other people use. Full design, budgets and the "provision your own room" determinism rule in [perf/README.md](../perf/README.md).

k6 runs on its own concurrency engine rather than the Vitest `HttpClient`, so it generates real parallel load; the scripts stay TypeScript, type-checked against `@types/k6` and gated in CI.

## Status

Every planned layer has shipped — functional suites, consumer contracts, security and ZAP, the dockerized target with its nightly drift run, and the performance smoke — and the milestones (M0–M10) are all closed. The last diagnostic thread, [#67](https://github.com/AKogut/restful-booker-api-testing/issues/67), was closed on evidence rather than a guess ([above](#how-the-ci-only-room-failures-resolved-67)).

What remains is upkeep: Dependabot proposes dependency and action updates, and the nightly live, drift, security and performance jobs report continuously against a target that changes underneath them.
