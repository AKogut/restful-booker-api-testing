# BUG-012: Oversized string input returns 500 instead of 400

| Field         | Value                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Severity      | Minor                                                                                                                 |
| Priority      | Medium                                                                                                                |
| Status        | Open                                                                                                                  |
| Service       | room                                                                                                                  |
| Endpoint      | `POST /api/room`                                                                                                      |
| Environment   | https://automationintesting.online (live), 2026-07-21                                                                 |
| Covering test | `tests/security/injection.security.test.ts` → `guardsDefect('BUG-012', 'rejects an oversized description cleanly …')` |

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

The `500` is also **slow, and unpredictably so**. Two consecutive measurements on 2026-07-22 took **31.27 s** and **31.31 s**; a suite run minutes later got its answer in **7.16 s**. The failure path appears to retry or block internally before giving up, and how long that takes is not stable.

## Impact

- **Unhandled path reachable from input.** A caller can drive a `500` with a single oversized field. Length limits should be enforced by validation, not by an exception at the persistence layer.
- **Inconsistent with the rest of the contract.** Every other invalid field on this endpoint (`roomPrice` out of range, wrong `type`, missing `roomName`) returns a clean `400`; only over-length falls through to `500`.

Severity **Minor**: no data is exposed and the room is not created; the cost is an incorrect status on a boundary that should validate. Included because unbounded/oversized input is squarely within an OWASP input-handling review, and the fix is the same validation pattern already used for the other fields.

## Notes

Guarded by a `guardsDefect` test asserting a clean `4xx`, using a client with an extended timeout because the `500` can take over 30 s to arrive.

That timeout is not incidental — **this guard never actually observed the `500` it documents.** Under the previous `it.fails` idiom the inverted outcome was satisfied either way: a fast `500` failed the assertion, and a slow response failed the transport, and both looked identical from the outside. Converting the guard to `guardsDefect` turned it red on the very first live run (`Test timed out in 30000ms`), which is what prompted measuring the latency above. It is the third instance of the false green described in [test-strategy.md](../test-strategy.md#why-not-itfails), and the only one found by the fix rather than before it.
