# Target Differences

The suite runs against two targets that implement **different versions of the same API**:

| Target  | What it is                                                         |
| ------- | ------------------------------------------------------------------ |
| `live`  | The hosted platform at `automationintesting.online`                |
| `local` | The published RBP images (`2.2`) via `docker compose`, run locally |

They are not interchangeable. This document records every difference the suite encodes, and why the differences are modelled rather than papered over.

## Why they differ

The hosted platform runs code that is **not** in the open-source project. Checked three ways:

1. The `2.2` images differ from live.
2. The `latest` images behave identically to `2.2` — so it is not a stale-tag problem.
3. Upstream `trunk` source matches the **images**, not live. `AuthController.createToken` returns `ResponseEntity.ok().build()` with a `Cookie`, and `HttpStatus.FORBIDDEN` on bad credentials — exactly what the containers do, and not what live does.

A fourth check ruled out the missing gateway: the `restfulbookerplatform_proxy` image is a pure nginx router (`location /room/ { proxy_pass http://rbp-room:3001; }`) with no auth logic and no body rewriting, so it cannot account for any of the deltas below.

**Conclusion:** live is ahead of the public source. No published artifact reproduces it. A single suite asserting one set of expectations cannot pass on both.

## Status code differences

Encoded in `src/profiles/target-profile.ts` as `expectedStatus(key)`.

| Key                         | live  | local | Meaning                                 |
| --------------------------- | ----- | ----- | --------------------------------------- |
| `resource.created`          | `200` | `201` | Room or message created                 |
| `booking.created`           | `201` | `201` | Booking created — agreed, kept explicit |
| `auth.rejected`             | `401` | `403` | Bad credentials on login                |
| `authz.missingToken`        | `401` | `403` | Protected endpoint called with no token |
| `authz.missingToken.report` | `401` | `400` | Same, for report and branding update    |
| `authz.forbidden`           | `403` | `403` | Agreed — kept explicit, not hard-coded  |
| `auth.tokenInvalid`         | `403` | `403` | Malformed token on validate — agreed    |

`authz.forbidden` is in the table despite both targets agreeing: a key that is currently identical still documents _where_ the contract is being asserted, and gives one place to change if a target moves.

## Capability differences

Encoded as `supports(key)`; suites gate with `itWhenSupported(key)`.

| Key                     | live | local | Effect when unsupported                         |
| ----------------------- | ---- | ----- | ----------------------------------------------- |
| `auth.tokenInBody`      | ✅   | ❌    | Body-shape assertion on login is skipped        |
| `auth.describesOutcome` | ✅   | ❌    | Error/success body assertions are skipped       |
| `authz.bookingSummary`  | ✅   | ❌    | Booking-summary authorization tests are skipped |
| `defects.documented`    | ✅   | ❌    | Every defect guard is skipped                   |

### Why the defect guards are live-only

Every report in [`bug-reports/`](bug-reports/) was found against live and describes live's behaviour. Running those guards against a different version would assert nothing meaningful — and worse, an `it.fails` that passes because _a different bug_ exists is a false green. They are scoped to the target they document.

Two of them are notably **not** reproducible locally, which is itself informative:

- [BUG-003](bug-reports/BUG-003-booking-update-leaks-internals.md) — live leaks internals only on booking update. **Locally every validation error leaks them**, including the full `org.springframework…` stack and `SQLException` text. Live has partially fixed what the public version does everywhere.
- [BUG-008](bug-reports/BUG-008-summary-accepts-any-token.md) — locally `booking.summary` has no authentication at all, so there is no presence-only check to defeat.

## Response shape differences

Shapes are adapted at the _acquisition_ boundary and asserted at the _contract_ boundary. Getting hold of a resource is plumbing; the exact body is the contract — so helpers normalize the first and capabilities gate the second.

| Response          | live                                    | local                                            | Adapter                          |
| ----------------- | --------------------------------------- | ------------------------------------------------ | -------------------------------- |
| `auth.login`      | `{"token":"…"}`                         | empty body + `Set-Cookie: token=…`               | `extractToken()`                 |
| `booking.create`  | flat `Booking`                          | `{"bookingid":…,"booking":{…}}`                  | `createdBooking()`               |
| validation errors | `{"errors":["size must be between …"]}` | `{"error":…,"errorMessage":…,"fieldErrors":[…]}` | `validationMessages()`           |
| `auth.validate`   | `{"valid":true}`                        | empty body                                       | gated by `auth.describesOutcome` |
| `auth.logout`     | `{"success":true}`                      | empty body                                       | gated by `auth.describesOutcome` |

The validation envelopes differ but the **messages inside are identical** (`must be greater than or equal to 1`), which is what the dataset matrices assert. That is the useful part of the contract; the envelope is version trivia.

## Gotchas found along the way

- **Trailing slashes matter locally.** `POST http://localhost:3001/room` answers `302` to `/room/`, and following a `302` turns a `POST` into a `GET` — so a create silently became a list, and the "response" was the room listing. `.env.local` therefore ends every base URL with `/`. Live does not redirect, so its URLs have no trailing slash.
- **`'token' in response.data` throws** when the body is an empty string rather than an object. Live always returns JSON, so this latent bug in `adminToken()` could never fire there. The local target found it.

## The local stack runs sequentially

`npm run test:local` passes `--no-file-parallelism`. The six containers share one small in-memory database, and running suites concurrently against it produced failures that moved between runs — a room's report showing another suite's booking, a round-trip finding the wrong record. Live tolerates parallel suites because each service has its own persistence and each suite provisions its own room.

This is a property of the target, not a workaround for a flaky test: the local run trades wall-clock for a single writer. Live keeps full parallelism.

## Adding a new difference

1. Add a key to `STATUS` or `CAPABILITIES` in `src/profiles/target-profile.ts`
2. Use `expectedStatus(key)` or `itWhenSupported(key)` in the suite
3. Add a row to the tables above
4. Verify **both** targets: `npm run test:live` and `npm run test:local`

Never hard-code a status that differs between targets, and never assert a target's _current wrong_ behaviour to make a suite pass — skip with a capability instead, so the gap stays visible.
