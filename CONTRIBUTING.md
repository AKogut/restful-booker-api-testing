# Contributing

This document defines the branching model, commit conventions, and workflow for this repository.

## Branching Model

`main` is protected and always releasable. All changes land through pull requests — no direct pushes to `main`.

Create a short-lived branch per issue, named `<type>/<issue-number>-<short-slug>`:

```
feat/12-booking-service-create
fix/27-property-based-shrink
ci/31-pr-gate-workflow
docs/37-bug-reports
```

Allowed branch prefixes:

| Prefix | Use for |
| --- | --- |
| `feat/` | New capability or feature |
| `fix/` | Bug fix |
| `test/` | Test coverage only |
| `ci/` | CI/CD pipelines |
| `docs/` | Documentation |
| `chore/` | Tooling, config, maintenance |
| `refactor/` | Internal change, no behavior change |

## Commit Convention

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and are enforced by commitlint:

```
<type>(<optional scope>): <description>

feat(services): add BookingService.createBooking
test(negative): cover missing-token update
ci: add nightly regression workflow
```

Types: `feat`, `fix`, `test`, `ci`, `docs`, `chore`, `refactor`, `perf`, `build`.

## Pull Requests

- One PR per issue; link it with `Closes #<issue>`.
- Keep PRs focused and small.
- All status checks (typecheck, lint, tests) must pass.
- Squash merge only; delete the branch after merge.

## Workflow

```bash
git switch -c feat/12-booking-service-create
# implement change
npm run typecheck && npm run lint && npm test
git push -u origin HEAD
gh pr create --fill
```

## Quality Gates

- TypeScript runs in `strict` mode and must type-check.
- ESLint and Prettier must pass.
- New behavior must be covered by tests.
- Code is self-documenting; avoid inline comments in favor of clear naming.
