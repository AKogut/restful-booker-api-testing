# BUG-009: Report stalls ~31 seconds before rejecting an invalid token

| Field         | Value                                                                                |
| ------------- | ------------------------------------------------------------------------------------ |
| Severity      | Major                                                                                |
| Priority      | High                                                                                 |
| Status        | Open                                                                                 |
| Service       | report                                                                               |
| Endpoint      | `GET /api/report`                                                                    |
| Environment   | https://automationintesting.online (live), 2026-07-20                                |
| Covering test | `tests/negative/authorization.test.ts` → `it.fails('rejects report.get … stalling')` |

## Summary

With no token, the endpoint rejects the request in ~0.16 s. With a token that is present but invalid, it holds the connection for **~31 seconds** and then returns `500`. An unauthenticated caller decides how long a server thread stays occupied.

## Steps to Reproduce

1. `GET /api/report` with no `Cookie` header — `401` in ~0.16 s
2. `GET /api/report` with `Cookie: token=garbage-not-a-real-token`

## Expected Result

Step 2 returns `401` immediately. Rejecting an unrecognised credential requires no downstream work.

## Actual Result

Step 2 returns `500 An unexpected error occurred` after ~31 seconds.

## Evidence

Three consecutive runs, timed:

```bash
for i in 1 2 3; do
  curl -s -o /dev/null -w '%{http_code} in %{time_total}s\n' --max-time 35 \
    https://automationintesting.online/api/report -H 'Cookie: token=garbage-not-a-real-token'
done
# 500 in 31.492346s
# 500 in 31.473569s
# 500 in 31.626842s

curl -s -o /dev/null -w '%{http_code} in %{time_total}s\n' \
  https://automationintesting.online/api/report
# 401 in 0.164800s
```

The ~31 s figure is stable across runs, which points at a fixed internal timeout — most likely a downstream call the report service makes while resolving the token, which it waits out before surfacing the failure.

Comparable endpoints fail fast on identical input ([BUG-007](BUG-007-invalid-token-returns-500.md)):

| Endpoint       | Invalid token | Latency   |
| -------------- | ------------- | --------- |
| `POST /room`   | `500`         | ~0.3 s    |
| `GET /booking` | `500`         | ~0.2 s    |
| `GET /report`  | `500`         | **~31 s** |

So the stall is specific to `report`, not a property of invalid-token handling in general.

## Impact

- **Resource exhaustion is cheap to trigger.** One HTTP request with a junk cookie ties up a server-side thread for half a minute. No account, no valid token and no rate-limited login is required. A handful of concurrent requests can saturate the service's connection pool — this is a denial-of-service amplification vector, not merely slow error handling.
- **The failure is invisible to callers.** Most HTTP clients default to a timeout under 31 s, so the caller sees a transport timeout rather than the `500`. The real cause never reaches the client's logs. This suite hit exactly that: at the default 30 s client timeout the guarding test failed by _timeout_ rather than by assertion, and needed a dedicated 60 s client to observe the actual status.
- **Retries make it worse.** A client that treats the timeout as transient and retries multiplies the load precisely when the service is already saturated. This framework's retry policy excludes `500` and does not retry it, but a naive consumer would.

Severity **Major**: no data is exposed, but availability is affected by unauthenticated input.

## Discovery

Found while writing the guarding test for [BUG-007](BUG-007-invalid-token-returns-500.md). The test passed, but took 30.005 s — exactly the configured client timeout, which meant it was passing because the request timed out rather than because the status was wrong. Investigating that false green surfaced this defect.

## Related

- [BUG-007](BUG-007-invalid-token-returns-500.md) — `room.create` and `booking.list` return the same `500`, without the stall
- [BUG-008](BUG-008-summary-accepts-any-token.md) — `booking.summary` accepts any non-empty token

## Notes

Guarded by an `it.fails` test asserting `401`, using a client with an extended timeout so the assertion — not the transport — decides the outcome. The test costs ~31 s per run, which is the honest price of covering this defect until it is fixed.
