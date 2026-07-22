# Security Policy

## What this repository is

A test automation framework aimed at a **public demo API** ([automationintesting.online](https://automationintesting.online)) that is not operated by this project. It ships no service, stores no user data, and has no production deployment.

## Reporting a vulnerability in this framework

Open a [private security advisory](https://github.com/AKogut/restful-booker-api-testing/security/advisories/new), or email a.kogut01@gmail.com. Please do not open a public issue first.

Relevant classes here are narrow but real: credential handling in `src/config`, redaction in the exchange logger, and anything that could cause a token or a payload to reach CI logs or an uploaded artifact. The logger deliberately records **no bodies and no headers** for exactly that reason — a regression there is a security bug, not a cosmetic one.

## Defects found _in the platform under test_

Those are not handled through this policy. They are documented openly in [`docs/bug-reports/`](docs/bug-reports/), because the target is a public teaching sandbox whose maintainer publishes it to be tested against. Each report describes behaviour reachable by any anonymous caller and includes no third-party data.

## Supported versions

The `main` branch only. There are no releases and no backports.

## Scanning

An OWASP ZAP baseline scan runs nightly against the dockerized stack ([details](docs/security-scan.md)), and Dependabot proposes dependency updates weekly. Neither is a substitute for the other: ZAP inspects HTTP behaviour, Dependabot inspects the supply chain.
