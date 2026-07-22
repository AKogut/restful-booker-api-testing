# BUG-004: Message inbox is readable without authentication

| Field         | Value                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Severity      | Major (broken authorization / PII exposure)                                                           |
| Priority      | High                                                                                                  |
| Status        | Open                                                                                                  |
| Service       | message                                                                                               |
| Endpoint      | `GET /api/message`, `GET /api/message/{messageid}`                                                    |
| Environment   | https://automationintesting.online (live), 2026-07-17                                                 |
| Covering test | `tests/smoke/messages.test.ts` → `guardsDefect('BUG-004', 'protects the inbox from anonymous reads')` |

## Summary

The admin message inbox can be listed and read in full without any token. Anyone can retrieve every guest's name, email address, phone number and message body. Mutating the inbox (`mark read`, `delete`) is correctly protected — only reads are exposed, which points to a missing authorization check on the read paths rather than an intentional public endpoint.

## Steps to Reproduce

1. Without any token, `GET /api/message` → `200` with the full message list
2. Without any token, `GET /api/message/{messageid}` → `200` with `email`, `phone` and the message body

## Expected Result

Both read endpoints require a valid admin token and return `401` when none is supplied — consistent with `mark read` and `delete`, which return `403` without a token.

## Actual Result

Both endpoints return `200` and disclose personal data to anonymous callers.

```bash
curl -s https://automationintesting.online/api/message/1
# {"description":"...","email":"james@email.com","messageid":1,"name":"James Dean","phone":"01402 619211","subject":"Booking enquiry"}
```

## Impact

Unauthenticated disclosure of personal data (names, emails, phone numbers). Maps to OWASP API1 (Broken Object Level Authorization) and API3 (Broken Object Property Level Authorization); likely a data-protection concern for real deployments.

## Notes

Guarded by a `guardsDefect` test — the suite will flag the moment the defect is fixed so the marker can be removed.
