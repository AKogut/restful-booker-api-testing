# BUG-002: Fetching a deleted room returns 500 instead of 404

| Field         | Value                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| Severity      | Minor                                                                        |
| Priority      | Medium                                                                       |
| Status        | Open                                                                         |
| Service       | room                                                                         |
| Endpoint      | `GET /api/room/{roomid}`                                                     |
| Environment   | https://automationintesting.online (live), 2026-07-16                        |
| Covering test | `tests/smoke/rooms.test.ts` → `it.fails('returns 404 for a deleted room …')` |

## Summary

Requesting a room that does not exist (e.g. just deleted) crashes into an unhandled server error instead of a clean not-found response.

## Steps to Reproduce

1. Create a room (`POST /api/room`, authenticated) and resolve its `roomid` from the listing
2. Delete it: `DELETE /api/room/{roomid}` → `202`
3. Fetch it: `GET /api/room/{roomid}`

## Expected Result

Step 3 returns `404 Not Found`.

## Actual Result

Step 3 returns `500 Internal Server Error`:

```json
{
  "timestamp": "2026-07-16T08:56:34.858Z",
  "status": 500,
  "error": "Internal Server Error",
  "path": "/room/4"
}
```

## Impact

- Consumers cannot distinguish "room does not exist" from a genuine server failure
- Missing-entity handling likely throws an uncaught exception server-side (log noise, alert fatigue)

## Related Observations

Authorization failures are inconsistent across the same service: `POST /api/room` without a token → `401`, while `DELETE /api/room/{id}` without a token → `403`. Tracked informally; may warrant its own report.

## Notes

Guarded by an `it.fails` test — the suite will flag the moment the defect is fixed so the marker can be removed.
