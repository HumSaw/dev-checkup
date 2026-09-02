# Contributing

Thank you for improving dev-checkup.

1. Open an issue describing the false positive, missed case, or new check.
2. Keep checks deterministic, local, non-mutating, and dependency-free unless a dependency has a clear security and maintenance justification.
3. Add a focused fixture or unit test that fails before the change.
4. Run `npm run check`, `npm test`, and `npm pack --dry-run`.
5. Submit a small pull request with behavior, limitations, and migration impact documented.

New checks must have a stable rule name, structured JSON fields, actionable messages, and no network or shell execution. Please do not include real secrets or private webhook payloads in fixtures.
