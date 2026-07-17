# BUG-005: A booking can be created for a non-existent room

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Severity      | Major (broken referential integrity)                                                          |
| Priority      | High                                                                                          |
| Status        | Open                                                                                          |
| Service       | booking                                                                                       |
| Endpoint      | `POST /api/booking`                                                                           |
| Environment   | https://automationintesting.online (live), 2026-07-17                                         |
| Covering test | `tests/negative/boundary.test.ts` → `it.fails('rejects a booking for a non-existent room …')` |

## Summary

The booking service accepts and persists a booking that references a `roomid` which does not exist. No referential-integrity check ties a booking to a real room, so orphan bookings can be created for arbitrary room ids.

## Steps to Reproduce

1. `POST /api/booking` with a valid payload but `"roomid": 999999` (a room that does not exist)

## Expected Result

`404 Not Found` (or `400 Bad Request`) — the room does not exist, so the booking must be rejected.

## Actual Result

`201 Created` with a fully persisted booking:

```json
{
  "bookingid": 5,
  "roomid": 999999,
  "firstname": "Probe",
  "lastname": "Tester",
  "depositpaid": true,
  "bookingdates": { "checkin": "2028-04-01", "checkout": "2028-04-03" }
}
```

## Impact

- Orphan bookings pollute the data set and break the room ↔ booking relationship the report service relies on
- No foreign-key / existence validation between the booking and room services — a data-integrity gap in a microservices boundary

## Notes

Guarded by an `it.fails` test that adds the created id to teardown cleanup before asserting, so no orphan is left behind. The test flips red the moment the platform enforces the room reference.
