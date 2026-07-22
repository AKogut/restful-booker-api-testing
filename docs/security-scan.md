# Security Scan

An automated OWASP ZAP **baseline** scan runs against the dockerized platform. It complements — it does not replace — the `security` test suite.

## What each layer covers

| Layer                    | What it checks                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `npm run test:security`  | API semantics: BFLA/IDOR authorization, token tampering, injection, mass-assignment |
| ZAP baseline (this scan) | Transport and header hygiene: security headers, information disclosure, cookies     |

The suite understands the API's rules; ZAP understands HTTP. A baseline scan is **passive** — it inspects the traffic it observes and does not attack — so it independently surfaces the missing-security-header class this project documents as [BUG-011](bug-reports/BUG-011-missing-security-headers.md) (a real run flags `X-Content-Type-Options`, CSP, Permissions-Policy and CORP as warnings).

The infrastructure-header leak, [BUG-010](bug-reports/BUG-010-infrastructure-headers-leak.md), is a **live-only** finding: those `x-railway-*` / `x-hikari-*` headers come from the hosting platform, not the application, so they do not appear on the dockerized stack and the scan does not flag them. That gap is expected and is exactly the live-vs-local difference recorded in [target-differences.md](target-differences.md).

## Workflow

[`.github/workflows/security-scan.yml`](../.github/workflows/security-scan.yml):

1. Brings the six services up with `docker compose`, waiting on each service's context-path health endpoint.
2. Runs `zap-baseline.py` against the room service on the shared Docker network.
3. Uploads the HTML, Markdown and JSON reports as the `zap-baseline-report` artifact.
4. Fails the run only on **FAIL-level** alerts; warnings are recorded in the artifact but do not break the build.

It runs **daily** (04:00 UTC, an hour after the nightly report) and on demand via `workflow_dispatch`. It is deliberately not a pull-request gate: the scan is slow and, like every dockerized-target job, the container stack is a different version from live (see [target-differences.md](target-differences.md)), so it is a monitoring signal rather than a merge blocker.

## Triage

[`.zap/rules.tsv`](../.zap/rules.tsv) controls each alert's severity. The policy:

- **IGNORE** — noise on a JSON API (timestamp disclosure, suspicious-comment false positives, non-storable content).
- **WARN** (default) — everything else, including the missing-security-header and information-disclosure alerts. These are left visible on purpose because each already has a bug report; suppressing them would hide a known, tracked finding.
- **FAIL** — reserved for a genuinely blocking alert. None is set today, so a green run means "nothing new above the accepted baseline".

Suppressions carry their rationale inline in the rules file. An un-annotated suppression is a silent cap — the same anti-pattern this project avoids in its test coverage.

## Running it locally

```bash
npm run docker:up
docker run --network host -v "$PWD:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://localhost:3001/room/ -c .zap/rules.tsv \
  -r zap-report/baseline.html -I
npm run docker:down
```

The report lands in `zap-report/` (gitignored).
