# dev-checkup

> Ten fast, local repository checks in one zero-dependency CLI.

```bash
npx dev-checkup all
```

`dev-checkup` catches common repository failures before CI or production: mutable GitHub Actions, undocumented environment variables, case-sensitive path bugs, API shape drift, order-dependent tests, risky dependency licenses, leaked webhook secrets, architecture boundary violations, broken README links, and oversized files.

- Local-only: no account, network, telemetry, uploads, or command execution.
- Automation-friendly: stable findings and `--json` output.
- Dependency-free: Node.js 20+ is the only runtime.

## Quickstart

```bash
git clone https://github.com/HumSaw/dev-checkup.git
cd dev-checkup
npm link

dev-checkup all /path/to/project
dev-checkup all /path/to/project --json
```

Until the npm package is published, install directly from GitHub:

```bash
npm install -g github:HumSaw/dev-checkup
dev-checkup all
```

## Commands

| Command | Replaces | Purpose |
| --- | --- | --- |
| `actions [path]` | action-lock | Find mutable action refs and missing top-level permissions |
| `env [path]` | env-contract | Compare source env usage with `.env.example` |
| `case [path]` | caseguard | Find path case collisions and import mismatches |
| `shape capture file.json` | shape-lock | Produce a stable JSON shape baseline |
| `shape compare baseline.json file.json` | shape-lock | Report additive and breaking shape drift |
| `shuffle --seed 42 -- test-a test-b` | test-shuffle | Produce a deterministic alternate test order |
| `licenses [path]` | license-lens | Flag installed dependency licenses needing review |
| `webhooks payload.json` | webhook-scrub | Redact sensitive keys recursively |
| `boundaries [path] [config]` | boundary-check | Enforce denied import boundaries |
| `readme [path]` | readme-paths | Find missing local Markdown targets |
| `weight [path] --bytes 1048576` | git-weight | List oversized repository files |
| `all [path]` | — | Run safe, non-mutating repository checks together |

Use `--json` with any command. Exit codes are `0` for clean/success, `1` for findings, and `2` for invalid input.

## Configuration

`boundaries` reads `dev-checkup.config.json` by default:

```json
{
  "deny": {
    "src/ui": ["../database", "@internal/server"]
  }
}
```

`webhooks` accepts extra sensitive keys:

```bash
dev-checkup webhooks event.json --keys customer_id,phone
```

## Scope and limitations

The parsers are intentionally conservative and dependency-free. `actions` scans conventional workflow YAML lines rather than fully interpreting YAML; `env`, `case`, and `boundaries` use source patterns rather than language ASTs; `licenses` inspects installed Node packages and is not legal advice; `shape` infers array shape from the first element; `weight` scans the working tree rather than invoking Git. Findings should be reviewed before blocking releases.

## Development

```bash
npm test
npm run check
npm pack --dry-run
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md).

## License

MIT
