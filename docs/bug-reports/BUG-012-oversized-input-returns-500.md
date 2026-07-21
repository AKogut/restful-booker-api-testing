# BUG-012: Oversized string input returns 500 instead of 400

| Field         | Value                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| Severity      | Minor                                                                                      |
| Priority      | Medium                                                                                     |
| Status        | Open                                                                                       |
| Service       | room                                                                                       |
| Endpoint      | `POST /api/room`                                                                           |
| Environment   | https://automationintesting.online (live), 2026-07-21                                      |
| Covering test | `tests/security/injection.security.test.ts` → `it.fails('rejects an oversized … cleanly')` |

## Summary

A room `description` of a few thousand characters crashes the request with `500` instead of being rejected with a validation `400`. The field has an effective upper bound, but exceeding it throws rather than validates.

## Steps to Reproduce

```bash
mk() { python3 -c "print('A'*$1)"; }
create() {
  curl -s -o /dev/null -w '%{http_code}\n' -X POST https://automationintesting.online/api/room \
    -H 'Content-Type: application/json' -H "Cookie: token=$TOKEN" \
    -d "{\"roomName\":\"x\",\"type\":\"Single\",\"accessible\":true,\"image\":\"/i.jpg\",\"description\":\"$(mk $1)\",\"features\":[\"WiFi\"],\"roomPrice\":100}"
}
create 2000   # 200 — accepted
create 5000   # 500 — crash
```

## Expected Result

A description over the allowed length is rejected with `400` and a validation message naming the field and its limit, the same way `roomPrice` and `type` are validated.

## Actual Result

`200` up to ~2000 characters, then `500` between 2000 and 5000. The transition is a server error, not a validation boundary.

## Impact

- **Unhandled path reachable from input.** A caller can drive a `500` with a single oversized field. Length limits should be enforced by validation, not by an exception at the persistence layer.
- **Inconsistent with the rest of the contract.** Every other invalid field on this endpoint (`roomPrice` out of range, wrong `type`, missing `roomName`) returns a clean `400`; only over-length falls through to `500`.

Severity **Minor**: no data is exposed and the room is not created; the cost is an incorrect status on a boundary that should validate. Included because unbounded/oversized input is squarely within an OWASP input-handling review, and the fix is the same validation pattern already used for the other fields.

## Notes

Guarded by an `it.fails` test asserting `400`. The suite passes while the defect exists and flags the moment over-length input is validated rather than thrown on.
