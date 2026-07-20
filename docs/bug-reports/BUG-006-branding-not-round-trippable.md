# BUG-006: Branding cannot be round-tripped — GET returns a logoUrl that PUT rejects

| Field         | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Severity      | Minor                                                                                          |
| Priority      | Medium                                                                                         |
| Status        | Open                                                                                           |
| Service       | branding                                                                                       |
| Endpoint      | `GET /api/branding`, `PUT /api/branding`                                                       |
| Environment   | https://automationintesting.online (live), 2026-07-17                                          |
| Covering test | `tests/smoke/branding-report.test.ts` → `it.fails('accepts its own payload back on update …')` |

## Summary

`GET /api/branding` returns `logoUrl` as a **relative path** (`/images/rbp-logo.jpg`), but `PUT /api/branding` validates the same field with `@URL`, which requires an **absolute URL**. Reading the resource and writing it back unchanged — the most basic client flow — fails validation.

## Steps to Reproduce

1. `GET /api/branding` → note `"logoUrl": "/images/rbp-logo.jpg"`
2. `PUT /api/branding` with that exact body and a valid token

## Expected Result

The unmodified payload is accepted — a resource should be writable in the shape it is read.

## Actual Result

`400 Bad Request`:

```
Field error in object 'branding' on field 'logoUrl':
rejected value [/images/rbp-logo.jpg];
codes [URL.branding.logoUrl, URL.logoUrl, URL.java.lang.String, URL]
```

## Impact

- The read shape and write contract disagree, so any client that edits one branding field must also rewrite `logoUrl` into an absolute URL
- Combined with [BUG-003](BUG-003-booking-update-leaks-internals.md), the failure also exposes the Spring controller signature and `java.sql.SQLException`

## Notes

Guarded by an `it.fails` test. The attempt is rejected with `400`, so no branding state on the shared demo instance is mutated by the test.
