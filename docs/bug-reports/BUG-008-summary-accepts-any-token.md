# BUG-008: Booking summary accepts any non-empty token

| Field         | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Severity      | Major                                                                                  |
| Priority      | High                                                                                   |
| Status        | Open                                                                                   |
| Service       | booking                                                                                |
| Endpoint      | `GET /api/booking/summary?roomid={id}`                                                 |
| Environment   | https://automationintesting.online (live), 2026-07-20                                  |
| Covering test | `tests/negative/authorization.test.ts` → `it.fails('rejects booking.summary … token')` |

## Summary

The endpoint checks that a `token` cookie is **present**, never that it is **valid**. Any non-empty string authenticates. Authentication here is a presence check wearing the costume of an authorization control.

## Steps to Reproduce

1. `GET /api/booking/summary?roomid=1` with no `Cookie` header
2. Repeat with `Cookie: token=x`

## Expected Result

Step 2 returns `401` — the same answer step 1 gives, since neither request carries a credential the service issued.

## Actual Result

Step 2 returns `200` with the booking summary.

## Evidence

| Token sent                 | Status | Body                                                             |
| -------------------------- | ------ | ---------------------------------------------------------------- |
| _(no cookie)_              | `401`  | `{"error":"Authentication required"}`                            |
| `garbage-not-a-real-token` | `200`  | `{"bookings":[{"bookingDates":{"checkin":"…","checkout":"…"}}]}` |
| `x`                        | `200`  | identical                                                        |
| `aaaaaaaaaaaaaaaa`         | `200`  | identical                                                        |
| `' OR 1=1--`               | `200`  | identical                                                        |
| _(valid admin token)_      | `200`  | identical                                                        |

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  'https://automationintesting.online/api/booking/summary?roomid=1'
# 401

curl -s -o /dev/null -w '%{http_code}\n' \
  'https://automationintesting.online/api/booking/summary?roomid=1' -H 'Cookie: token=x'
# 200
```

A single character defeats the control.

## Impact

The response body is anonymized — it exposes only check-in and check-out dates, with no guest identity — and `GET /api/report/room/{id}` returns comparable availability data with no authentication at all by design. **The data disclosure here is therefore low.**

The defect is the control, not the payload:

- **The `401` is misleading.** It advertises an authentication requirement the service does not enforce, so any reviewer auditing this endpoint by its status codes concludes it is protected when it is not.
- **The flawed pattern is what generalizes.** A presence-only token check is a copy-paste risk: applied to an endpoint returning guest names, emails or phone numbers, the same code is a straightforward data breach.
- **It defeats token revocation.** Logging out cannot restrict access that never depended on a real token — compounding [BUG-001](BUG-001-token-survives-logout.md), where tokens already survive logout.

Severity is **Major** on the strength of the broken control and its blast radius if reused, not on the sensitivity of what this particular endpoint returns.

## Discovery

Found by probing every protected endpoint with an invalid token while reproducing [BUG-007](BUG-007-invalid-token-returns-500.md). The neighbouring endpoints fail in the opposite direction — they `500` on the same input — which is what made the `200` conspicuous.

## Related

- [BUG-007](BUG-007-invalid-token-returns-500.md) — invalid tokens crash `room.create` and `booking.list`
- [BUG-009](BUG-009-report-stalls-on-invalid-token.md) — an invalid token stalls `report.get` for ~31 s
- [BUG-001](BUG-001-token-survives-logout.md) — tokens remain valid after logout
- [BUG-004](BUG-004-message-inbox-public.md) — message inbox readable with no authentication

## Notes

Guarded by an `it.fails` test asserting `401`. The suite passes while the defect exists and flags the moment the platform is fixed.
