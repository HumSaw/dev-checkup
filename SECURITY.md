# Security policy

Report vulnerabilities privately through GitHub Security Advisories for `HumSaw/dev-checkup`. Do not open a public issue for an unpatched vulnerability.

Supported versions: the latest released minor version. dev-checkup reads local repository files but does not execute inspected code, invoke a shell, upload source, use telemetry, or make network requests. Treat output as untrusted when embedding it in another system, and review redacted fixtures before publishing because key-based redaction cannot detect every sensitive value.
