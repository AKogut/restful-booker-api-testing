# Bug Reports

Defects found in the Restful Booker Platform while building this framework. Each report is backed by an `it.fails` test that keeps the defect visible: the suite passes while the bug exists and flags the test the moment the platform fixes it.

| ID                                                   | Title                                                                 | Service       | Severity | Status |
| ---------------------------------------------------- | --------------------------------------------------------------------- | ------------- | -------- | ------ |
| [BUG-001](BUG-001-token-survives-logout.md)          | Auth token remains valid after logout                                 | auth          | Major    | Open   |
| [BUG-002](BUG-002-deleted-room-returns-500.md)       | Fetching a deleted room returns 500 instead of 404                    | room          | Minor    | Open   |
| [BUG-003](BUG-003-booking-update-leaks-internals.md) | Booking update validation errors leak internal implementation details | booking       | Major    | Open   |
| [BUG-004](BUG-004-message-inbox-public.md)           | Message inbox is readable without authentication                      | message       | Major    | Open   |
| [BUG-005](BUG-005-booking-nonexistent-room.md)       | A booking can be created for a non-existent room                      | booking       | Major    | Open   |
| [BUG-006](BUG-006-branding-not-round-trippable.md)   | Branding cannot be round-tripped (GET returns a logoUrl PUT rejects)  | branding      | Minor    | Open   |
| [BUG-007](BUG-007-invalid-token-returns-500.md)      | An invalid token returns 500 instead of 401                           | room, booking | Major    | Open   |
| [BUG-008](BUG-008-summary-accepts-any-token.md)      | Booking summary accepts any non-empty token                           | booking       | Major    | Open   |
| [BUG-009](BUG-009-report-stalls-on-invalid-token.md) | Report stalls ~31 s before rejecting an invalid token                 | report        | Major    | Open   |
| [BUG-010](BUG-010-infrastructure-headers-leak.md)    | Responses leak infrastructure details in headers                      | all           | Minor    | Open   |
| [BUG-011](BUG-011-missing-security-headers.md)       | API responses carry no standard security headers                      | all           | Minor    | Open   |
