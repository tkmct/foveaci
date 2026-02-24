# PR UX Evaluation Contract

## Goal
- Primary objective: visualize UX impact of new feature changes at PR level.
- This phase prioritizes reviewer visibility over strict CI blocking.

## Input Sources for Scenario Generation
- PR diff (changed files between base and head).
- PR metadata (title, body, labels).
- Changed lines only from `README.md`, `SPEC.md`, and `docs/`.

## Review and Execution Flow
1. Run `fov discover` to generate candidate scenarios.
2. Review generated scenarios in sticky PR preview comment.
3. Add `+1` reaction on the latest FoveaCI preview comment.
4. Run `approve_scenarios.mjs` to produce `approved-scenarios.yml`.
5. Run `fov pr-eval` to execute only approved scenarios.

## Approval Gate
- Execution starts when a valid `+1` reaction approval exists on latest preview comment.
- Approval requires repository permission `write` or higher.
- Local dry-run remains possible with `--skip-label-check`.

## CI Behavior
- Initial mode is informational; no hard gate failure by default.
- PR comment should be sticky and updated with:
  - proposed scenarios,
  - approval status,
  - execution summary,
  - artifact links.

## Non-Goals (Current Phase)
- Fixed monitoring of stable major flows (for example signup/login).
- Always-on global UX regression gate for every PR.
- Mandatory CI fail based on thresholds.
