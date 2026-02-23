# FoveaCI

**Synthetic User Swarm UX-CI** — Synthetic users operate your Web UI in a human-like manner, visualized as Session Replay (rrweb-compatible). Detect UX regressions in CI and fail the build automatically.

## Overview

FoveaCI runs persona-driven synthetic users through your web application's task flows (signup, checkout, onboarding, etc.) with human-like interactions, recording every action as rrweb-compatible Session Replay. It automatically extracts UX metrics and fails your CI pipeline when configured thresholds are breached, preventing UX regressions from reaching production.

### Key Features

- **Human-like interactions**: Bezier-curve mouse movements, jitter, misclicks, typos with backspace corrections
- **Fake cursor overlay**: SVG cursor injected into the page, visible in replay
- **rrweb-compatible recording**: DOM mutations, mouse movements, clicks, inputs, and scrolls
- **PII protection**: Input values automatically masked (`***`), emails/passwords stripped from logs
- **Automatic metrics extraction**: Success rate, task time, error count, rage clicks, and more
- **CI gate evaluation**: Returns exit code 1 when thresholds are breached, failing the CI pipeline
- **Static HTML report**: Self-contained replay viewer that opens as a local file

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm

### Install

```bash
pnpm install
npx playwright install chromium
```

### Build

```bash
pnpm build
```

### Run the Example

A bundled miniapp (simple signup page) is included for quick verification.

```bash
# 1. Start the miniapp server
npx serve examples/miniapp -p 3456 -s &

# 2. Run FoveaCI
pnpm fov run --config ./config/examples/basic.yml --out ./artifacts/run1

# 3. Open the report
open ./artifacts/run1/report/index.html   # macOS
xdg-open ./artifacts/run1/report/index.html  # Linux
```

## CLI

```
fov run --config <path> --out <dir> [--headed] [--advisor on|off]
fov discover --base <ref> --head <ref> --pr-metadata <path> --out <dir>
fov pr-eval --config <path> --scenario-file <path> --pr-metadata <path> --out <dir> [--baseline <dir>]
fov compare --baseline <dir> --candidate <dir> --out <dir>
fov serve-report --dir <path> [--host 127.0.0.1] [--port 4173]
```

### `run` options

| Option | Required | Description |
|---|---|---|
| `--config <path>` | Yes | Path to config YAML file |
| `--out <dir>` | Yes | Output directory for artifacts |
| `--headed` | No | Run browser in headed mode (for debugging) |
| `--advisor <on|off>` | No | Enable or disable advisor generation (default: `on`) |

### PR UX Evaluation Flow

1. Generate scenarios from PR context:
   - `fov discover --base origin/main --head HEAD --pr-metadata ./artifacts/pr.json --out ./artifacts/pr-discovery`
2. Review `./artifacts/pr-discovery/discovered-scenarios.yml` and set `approved: true` for scenarios to execute.
3. Add PR label `ux-eval-approved`.
4. Run approved scenarios:
   - `fov pr-eval --config ./config/examples/pr-eval-sample.yml --scenario-file ./artifacts/pr-discovery/discovered-scenarios.yml --pr-metadata ./artifacts/pr.json --out ./artifacts/pr-eval`

GitHub Actions workflow (`.github/workflows/pr-ux-eval.yml`) uses the same flow:
1. Always generate and post scenario preview as a sticky PR comment.
2. Execute PR evaluation only when label `ux-eval-approved` is present.
3. Update the same sticky comment with run summary, Advisor Top Suggestions, and artifact references.

### Localhost Replay Hosting

To view replay reports from downloaded artifacts on localhost:

```bash
# from foveaci repo
node ./dist/bin/fov.js serve-report --dir ./artifacts/pr-eval/report --port 4173

# then open
http://localhost:4173/index.html
```

### Exit Codes

| Code | Meaning |
|---|---|
| `0` | Command completed successfully |
| `1` | Validation failed, gate failed, or execution error |

## Configuration (YAML)

```yaml
project:
  name: "myapp"
  baseUrl: "http://localhost:3000"

run:
  browser: "chromium"        # chromium | firefox | webkit
  headless: true
  video: false               # Playwright video recording
  trace: false               # Playwright trace
  concurrency: 1             # TODO: parallel session count
  timeoutMs: 60000

recording:
  rrweb: true                # rrweb-compatible recording
  maskInputs: true           # Mask input values (PII protection)
  fakeCursor: true           # Inject fake cursor overlay

personas:
  - id: "normal_user"
    speed: 1.0               # Speed multiplier (>1 faster, <1 slower)
    jitterPx: 2.0            # Mouse endpoint jitter (px)
    misclickRate: 0.02        # Probability of misclick
    typoRate: 0.02            # Probability of typo
    patienceMs: 3000          # How long the user will wait

tasks:
  - id: "signup"
    entry: "/"               # Entry path (joined with baseUrl)
    goal: "Sign up and reach the dashboard"
    steps:
      - kind: "click"
        target: { role: "button", name: "Sign up" }
      - kind: "type"
        target: { label: "Email" }
        value: "test+{{runId}}@example.com"
      - kind: "type"
        target: { label: "Password" }
        value: "Passw0rd!{{runId}}"
      - kind: "click"
        target: { role: "button", name: "Create account" }
      - kind: "wait"
        value: "1500"
      - kind: "expect"
        target: { text: "Dashboard" }

gates:
  - metric: "taskSuccessRate"
    op: ">="
    value: 0.95
  - metric: "medianTaskTimeMs"
    op: "<="
    value: 45000
```

### Step Types

| kind | Description | Required fields |
|---|---|---|
| `click` | Click an element (with human-like mouse movement) | `target` |
| `type` | Type text (with typos and corrections) | `target`, `value` |
| `scroll` | Scroll the page | - |
| `wait` | Wait for specified milliseconds | `value` (ms) |
| `expect` | Assert element visibility | `target` |
| `goto` | Navigate to URL | `url` or `value` |
| `snapshot` | Take a screenshot | - |

### Target Selectors

```yaml
target: { role: "button", name: "Submit" }  # ARIA role + accessible name
target: { label: "Email" }                   # Form label
target: { text: "Dashboard" }                # Text content
target: { css: "#my-element" }               # CSS selector
```

### Template Variables

Use `{{runId}}` inside `value` fields to generate a unique ID per run. Useful for creating unique test email addresses.

### Gate Metrics

| metric | Description |
|---|---|
| `taskSuccessRate` / `successRate` | Task success rate (0.0 - 1.0) |
| `medianTaskTimeMs` / `medianTime` | Median task completion time (ms) |
| `p95TaskTimeMs` | p95 task completion time (ms) |
| `errorRate` | Average errors per session |
| `totalErrors` | Total errors across all sessions |

### Gate Operators

| op | Meaning |
|---|---|
| `>=` | Greater than or equal |
| `<=` | Less than or equal |
| `>` | Greater than |
| `<` | Less than |
| `==` | Equal |
| `!=` | Not equal |

## Output Artifacts

```
<out>/
  run-metrics.json              # Aggregated run-level metrics
  sessions/
    <taskId>_<personaId>_<n>/
      events.json               # rrweb-compatible events
      metrics.json              # Per-session metrics
      console.json              # Console logs
      network.json              # Network logs
      trace.zip                 # Playwright trace (when trace: true)
  report/
    index.html                  # HTML report with replay viewer
```

### Report

Open `report/index.html` in a browser to see:

- Run-level metrics summary (success rate, task time, errors, rage clicks)
- Session list (click to expand)
- Per-session rrweb replay with fake cursor (play/pause/seek/speed controls)
- Step execution results (pass/fail, duration, error details)

## Project Structure

```
bin/
  fov.ts                  # CLI entry point
src/
  config.ts               # YAML config loader, types, validation
  runner.ts               # Playwright execution engine
  recording.ts            # rrweb-compatible recorder injection + fake cursor
  metrics.ts              # Metrics extraction + gate evaluation
  scenario/
    discovery.ts          # PR diff + metadata based scenario generation
    derive.ts             # Heuristic scenario proposal derivation
    pr-context.ts         # PR metadata parsing and approval label checks
  behavior/
    mouse.ts              # Bezier-curve mouse movement, jitter, misclick
    typing.ts             # Human-like typing (typos + backspace correction)
    index.ts              # Barrel export
  report/
    index.ts              # Static HTML report generator
config/
  examples/
    basic.yml             # Basic config example
    strict-gates.yml      # Strict gates for failure testing
    pr-eval-sample.yml    # Base config for PR-centric scenario execution
docs/
  pr_ux_evaluation_contract.md  # PR UX evaluation scope and approval flow
examples/
  miniapp/
    index.html            # Sample web app (signup -> dashboard)
```

## CI Integration (GitHub Actions)

```yaml
jobs:
  ux-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm build
      - run: npx playwright install chromium

      # Start your app in the background
      - run: npm start &
      - run: npx wait-on http://localhost:3000

      # Run FoveaCI (exit code 1 on gate failure)
      - run: pnpm fov run --config ./config/uxci.yml --out ./artifacts/run1

      # Upload report as artifact
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: foveaci-report
          path: ./artifacts/run1/report/
```

## Design Constraints

- **Observation restriction**: Decision logic uses only screenshot-derived information. Full DOM text extraction (e.g. innerText) is prohibited
- **PII protection**: Input values are masked in both rrweb events and logs. Access tokens are never persisted in artifacts
- **rrweb compatibility**: A lightweight custom recorder produces rrweb-compatible events without bundling the rrweb library

## Roadmap

MVP (M0-M2) is implemented.

- [x] **M0**: CLI skeleton, YAML loading, artifact directory creation
- [x] **M1**: Runner + rrweb replay (Playwright execution, rrweb recording, fake cursor, HTML report)
- [x] **M2**: Metrics + Gate (success rate / time / errors / rage clicks, gate evaluation)
- [ ] **M3**: Baseline Diff (cross-branch comparison)
- [ ] **M4**: Advisor (AI / rule-based UX improvement suggestions)
- [ ] **M5**: Swarm (parallel execution, seed pinning, flaky retry)

## License

TBD
