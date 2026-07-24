# Performance

A [k6](https://k6.io) smoke-load harness for the critical booking flows. It answers a different question from the functional suites: not "is the response correct?" but "does the platform hold its latency and error budgets under concurrent load?"

## What it exercises

`smoke.ts` drives the highest-value path — the one a real guest hits — under a ramping-VU profile:

| Step           | Method                                | Budget-bearing |
| -------------- | ------------------------------------- | -------------- |
| room list      | `GET /room`                           | read           |
| booking create | `POST /booking`                       | write          |
| booking list   | `GET /booking?roomid` (authenticated) | read           |

`setup()` logs in once and **provisions a dedicated room** for the run; the VUs book disjoint date windows against it (keyed off k6's global iteration index, so no two bookings collide); `teardown()` deletes the room. Provisioning its own room is the same determinism rule the functional suites follow — a shared seed room's calendar fills up across runs and starts throwing overlap `409`s, which would read as a performance failure when it is really test-data contention.

## Budgets

Enforced as k6 thresholds, so a breach exits non-zero and fails the run:

| Budget        | Default     | Env override      |
| ------------- | ----------- | ----------------- |
| p95 latency   | `< 1000 ms` | `PERF_P95_MS`     |
| error rate    | `< 1%`      | `PERF_ERROR_RATE` |
| check success | `> 99%`     | `PERF_CHECK_RATE` |

Load shape and target are parameterized too: `PERF_VUS` (peak VUs, default 5), `PERF_RAMP` / `PERF_HOLD` (stage durations), and `PERF_TARGET` (`local` | `live`) or explicit `AUTH_URL` / `ROOM_URL` / `BOOKING_URL`.

## Running it

```bash
npm run docker:up      # bring up the dockerized RBP
npm run perf:smoke     # k6 run against localhost
npm run docker:down
```

`perf:smoke` writes `perf-summary.json` (gitignored) and prints a one-line result. To prove the gate bites, force an impossible budget:

```bash
PERF_P95_MS=1 npm run perf:smoke   # exits 99, threshold p(95)<1 fails
```

## Target it against, and what NOT to target

The smoke **writes** bookings, so run it only against a disposable instance — the dockerized stack, or your own. It defaults to `local` for exactly this reason. Do **not** point the write scenario at the shared public demo (`PERF_TARGET=live`): it would leave load-test bookings on an environment other people use. The `live` target exists for read-only experimentation, not for the booking-create load.

## In CI

[`.github/workflows/perf.yml`](../.github/workflows/perf.yml) runs the smoke **nightly at 05:00 UTC** (after the local-target, report and ZAP jobs, so the dockerized jobs never contend for ports) and on demand. It brings the stack up, runs k6, publishes `perf-summary.json` as an artifact, and fails the run if any budget was breached — so a latency or error-rate regression surfaces in the run status. It is not a pull-request gate: load figures vary run to run and the dockerized target is a different version from live, so this is a monitoring signal, not a merge blocker.

## Why k6 and not the Vitest client

k6 runs on its own high-concurrency engine (goja + a Go VU scheduler), not Node, so it generates real concurrent load that the axios-based `HttpClient` cannot. The scripts are still TypeScript, type-checked against `@types/k6` via [`perf/tsconfig.json`](tsconfig.json) (`npm run perf:typecheck`, also gated in CI).
