# BUG-007: An invalid token returns 500 instead of 401

| Field         | Value                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Severity      | Major                                                                                                     |
| Priority      | High                                                                                                      |
| Status        | Open                                                                                                      |
| Service       | room, booking                                                                                             |
| Endpoint      | `POST /api/room`, `GET /api/booking`                                                                      |
| Environment   | https://automationintesting.online (live), 2026-07-20                                                     |
| Covering test | `tests/negative/authorization.test.ts` → `guardsDefect('BUG-007', 'rejects … carrying an invalid token')` |

## Summary

Two protected endpoints answer `401` when the `token` cookie is absent, but crash into `500 An unexpected error occurred` when the cookie is present and holds a value the service cannot validate. Token validation throws instead of denying.

## Steps to Reproduce

1. Send a request to a protected endpoint with no `Cookie` header — observe `401`
2. Send the same request with `Cookie: token=garbage-not-a-real-token`

## Expected Result

Step 2 returns `401 Unauthorized`. An unparseable token is exactly the case `401` exists for, and the service already produces it when the token is missing entirely.

## Actual Result

Step 2 returns `500 Internal Server Error`:

```json
{ "errors": ["An unexpected error occurred"] }
```

## Evidence

| Endpoint            | No token | Invalid token | Latency |
| ------------------- | -------- | ------------- | ------- |
| `POST /room`        | `401`    | **`500`**     | ~0.3 s  |
| `GET /booking`      | `401`    | **`500`**     | ~0.2 s  |
| `DELETE /room/1`    | `403`    | `403`         | ~0.2 s  |
| `DELETE /message/1` | `403`    | `403`         | ~0.2 s  |

`DELETE` on room and message handles the same input correctly, so the defect is confined to the endpoints above rather than being platform-wide. `GET /report` also returns `500`, but stalls for ~31 s first and is tracked separately as [BUG-009](BUG-009-report-stalls-on-invalid-token.md).

```bash
BODY='{"roomName":"77771234","type":"Single","accessible":true,"image":"/images/room2.jpg","description":"probe","features":["WiFi"],"roomPrice":100}'

curl -s -o /dev/null -w '%{http_code}\n' -X POST https://automationintesting.online/api/room \
  -H 'Content-Type: application/json' -d "$BODY"
# 401

curl -s -o /dev/null -w '%{http_code}\n' -X POST https://automationintesting.online/api/room \
  -H 'Content-Type: application/json' -H 'Cookie: token=garbage-not-a-real-token' -d "$BODY"
# 500
```

An empty value (`Cookie: token=`) reproduces the same `500`.

## Impact

- **A recoverable condition is reported as unrecoverable.** A client holding an expired token cannot tell "re-authenticate" from "the service is broken", so it cannot self-heal. Correct clients retry the wrong thing.
- **The API is inconsistent with itself.** The same input yields `401`, `403` or `500` depending on which endpoint receives it, so no general client-side rule can be written.
- **An unhandled exception is reachable from attacker-controlled input.** A 5xx on a hostile value indicates the validation path throws rather than rejects — cheap to trigger, and it generates server-side error noise.

## Discovery

Found while investigating a CI failure on PR #65, where `tests/smoke/rooms.test.ts` failed three times with `expected 500 to be 200` on room creation. The `500` traced to token validation, not to the room payload.

## Related

- [BUG-002](BUG-002-deleted-room-returns-500.md) — the same "throws instead of answering" pattern on a missing entity
- [BUG-008](BUG-008-summary-accepts-any-token.md) — the opposite failure on the neighbouring endpoint: an invalid token is accepted rather than rejected
- [BUG-009](BUG-009-report-stalls-on-invalid-token.md) — the same `500`, preceded by a ~31 s stall

## Notes

Guarded by `guardsDefect` tests asserting `401`. The suite passes while the defect exists and flags the moment the platform is fixed.

This guard is the one that absorbed a hung `POST /room` during the #67 investigation: under the previous `it.fails` idiom the timeout satisfied the inverted outcome and the run stayed green. Under `guardsDefect` a transport failure fails the test.
