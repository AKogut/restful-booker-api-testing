# BUG-010: Responses leak infrastructure details in headers

| Field         | Value                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| Severity      | Minor                                                                                     |
| Priority      | Low                                                                                       |
| Status        | Open                                                                                      |
| Service       | all                                                                                       |
| Endpoint      | every `/api/*` response                                                                   |
| Environment   | https://automationintesting.online (live), 2026-07-21                                     |
| Covering test | `tests/security/token-hardening.security.test.ts` → `it.fails('does not leak … headers')` |

## Summary

Every response carries headers that name the hosting platform and the database connection pool: `x-railway-request-id`, `x-railway-edge` and `x-hikari-trace`. These describe the internal stack to any caller.

## Steps to Reproduce

```bash
curl -s -D - -o /dev/null https://automationintesting.online/api/room | grep -iE '^x-(hikari|railway)'
# x-railway-request-id: dXeHFIAqQcKLTa9Fss7a6g
# x-railway-edge: ams1
# x-hikari-trace: ams1.9qww
```

## Expected Result

Responses expose no internal platform, framework or connection-pool identifiers. Request-correlation ids, where needed, use a neutral name that does not name the vendor.

## Actual Result

| Header                 | Discloses                   |
| ---------------------- | --------------------------- |
| `x-railway-request-id` | Hosting provider is Railway |
| `x-railway-edge`       | Deployment region (`ams1`)  |
| `x-hikari-trace`       | Database pool is HikariCP   |

Confirmed identical on `/room`, `/branding`, `/report/room/1` and `/message/count`, so it is a platform-wide default rather than one service's mistake.

## Impact

- **Reconnaissance aid.** Naming Railway and HikariCP tells an attacker which stack-specific advisories and misconfigurations to try, narrowing the search before any exploit is attempted.
- **Region disclosure.** `ams1` reveals deployment geography with no functional need.

Severity **Minor**: no data or credential is exposed and no single header is exploitable on its own; the cost is entirely in reconnaissance. Included because header hygiene is squarely within scope for an OWASP-oriented review, and because it is cheap to fix.

## Notes

Guarded by an `it.fails` test asserting the headers are absent. The suite passes while the defect exists and flags the moment the platform stops emitting them.
