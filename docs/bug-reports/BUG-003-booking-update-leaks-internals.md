# BUG-003: Booking update validation errors leak internal implementation details

| Field         | Value                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| Severity      | Major (information disclosure)                                                             |
| Priority      | High                                                                                       |
| Status        | Open                                                                                       |
| Service       | booking                                                                                    |
| Endpoint      | `PUT /api/booking/{bookingid}`                                                             |
| Environment   | https://automationintesting.online (live), 2026-07-16                                      |
| Covering test | `tests/smoke/bookings.test.ts` → `it.fails('returns clean validation errors on update …')` |

## Summary

When an update payload fails validation, the error response exposes internal implementation details: the full Spring controller method signature, framework class names, declared `java.sql.SQLException`, and bean-validation code lists. The create endpoint validates the same fields cleanly, so the platform already has a proper error format — the update path bypasses it.

## Steps to Reproduce

1. Authenticate and create a booking
2. `PUT /api/booking/{bookingid}` with an invalid field, e.g. `"firstname": "X"` (shorter than the 3-character minimum), valid token

## Expected Result

`400` with a clean validation message, consistent with the create endpoint:

```json
{ "errors": ["size must be between 3 and 18"] }
```

## Actual Result

`400` exposing internals:

```json
{
  "error": "BAD_REQUEST",
  "errorCode": 400,
  "errorMessage": "Validation failed for argument [0] in public org.springframework.http.ResponseEntity<com.automationintesting.model.db.CreatedBooking> com.automationintesting.api.BookingController.updateBooking(com.automationintesting.model.db.Booking,int,java.lang.String) throws java.sql.SQLException with 2 errors: [Field error in object 'booking' on field 'firstname': rejected value [X]; codes [Size.booking.firstname,Size.firstname,Size.java.lang.String,Size]; ..."
}
```

## Impact

- Discloses framework, package structure, controller and model class names, and persistence details (`java.sql.SQLException`) — reconnaissance material for an attacker (OWASP API8, Security Misconfiguration)
- Error contract is inconsistent between create (`{"errors":[...]}`) and update (`{"error","errorCode","errorMessage"}`), complicating client-side handling

## Notes

Guarded by an `it.fails` test — the suite will flag the moment the defect is fixed so the marker can be removed.
