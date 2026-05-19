# Security policy

This repository is published under HMCTS's code-in-the-open posture. If
you find a security issue, please **do not** open a public GitHub issue.

## Reporting a vulnerability

Email the HMCTS security team using the contact channel published on
the [Ministry of Justice security advisories](https://security-guidance.service.justice.gov.uk/)
page. Include:

- The repository name (`hmcts/dts-portfolio-portal`)
- A description of the issue (what, where, severity if you can judge it)
- Steps to reproduce, or a proof-of-concept if appropriate
- Your preferred channel for follow-up

We aim to acknowledge reports within two working days.

## What's in scope

- The deployed portal at the production URL once published
- This repository's CI/CD pipeline and dependency chain
- The infrastructure repo (`hmcts/dts-portfolio-portal-infra`) when public

## What's out of scope

- Third-party services we depend on (Azure, GitHub, HMCTS ACR) — please
  report those to the upstream owner
- Issues that require pre-authenticated insider access (see HMCTS
  insider-threat process instead)

Thank you for taking the time to report.
