# BUG-011: API responses carry no standard security headers

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Severity      | Minor                                                                                         |
| Priority      | Low                                                                                           |
| Status        | Open                                                                                          |
| Service       | all                                                                                           |
| Endpoint      | every `/api/*` response                                                                       |
| Environment   | https://automationintesting.online (live), 2026-07-21                                         |
| Covering test | `tests/security/token-hardening.security.test.ts` → `it.fails('sets the standard … headers')` |

## Summary

None of the standard HTTP security headers are present on API responses: no `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` or `Content-Security-Policy`.

## Steps to Reproduce

```bash
curl -s -D - -o /dev/null https://automationintesting.online/api/room \
  | grep -icE '^(strict-transport-security|x-content-type-options|x-frame-options|content-security-policy)'
# 0
```

## Expected Result

At minimum:

- `Strict-Transport-Security` — enforce HTTPS on subsequent requests
- `X-Content-Type-Options: nosniff` — stop MIME sniffing

`X-Frame-Options` / `Content-Security-Policy` matter less for a pure JSON API but are cheap to add.

## Actual Result

Zero of the four are set on any endpoint checked.

## Impact

- **No HSTS.** A first request over plain HTTP is open to downgrade/interception before any redirect; without HSTS the browser is never told to refuse HTTP next time.
- **No `nosniff`.** A client that renders a response can be induced to MIME-sniff it into an unintended content type.

Severity **Minor**: the practical exposure for a JSON API consumed by non-browser clients is limited, and the absence is partly a property of the deployment (Cloudflare/Railway) rather than the application. It is documented because the two headers above are a baseline any security review is expected to check, and their absence is a real, if low, finding.

## Notes

Because the headers are a deployment concern, this is asserted only against the `live` target. Guarded by an `it.fails` test; the suite flags the moment the headers appear.
