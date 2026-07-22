# BUG-001: Auth token remains valid after logout

| Field         | Value                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------- |
| Severity      | Major                                                                                        |
| Priority      | High                                                                                         |
| Status        | Open                                                                                         |
| Service       | auth                                                                                         |
| Endpoint      | `POST /api/auth/logout`, `POST /api/auth/validate`                                           |
| Environment   | https://automationintesting.online (live), 2026-07-16                                        |
| Covering test | `tests/smoke/auth.test.ts` → `guardsDefect('BUG-001', 'invalidates the token after logout')` |

## Summary

Logging out reports success but does not destroy the token. A logged-out token still passes validation, so the session cannot actually be terminated.

## Steps to Reproduce

1. `POST /api/auth/login` with `{"username":"admin","password":"password"}` → receive `{"token":"<token>"}`
2. `POST /api/auth/logout` with `{"token":"<token>"}` → `200 {"success":true}`
3. `POST /api/auth/validate` with the same token

## Expected Result

Step 3 returns `403` — the token was destroyed by logout.

## Actual Result

Step 3 returns `200 {"valid":true}` — the token is still active.

## Evidence

```bash
TOKEN=$(curl -s -X POST https://automationintesting.online/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' | jq -r .token)

curl -s -X POST https://automationintesting.online/api/auth/logout \
  -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\"}"
# {"success":true}

curl -s -X POST https://automationintesting.online/api/auth/validate \
  -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\"}"
# {"valid":true}  <-- expected 403
```

## Impact

Broken session termination: a leaked or intercepted token cannot be revoked by logging out, extending the window for session hijacking. Maps to OWASP API2 (Broken Authentication).

## Notes

Guarded by a `guardsDefect` test — the suite will flag the moment the defect is fixed so the marker can be removed.
