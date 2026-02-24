# Implementation Roadmap (PR-Centric New Feature UX Evaluation)

## Scope and Delivery Model
This roadmap prioritizes internal adoption of PR-level UX evaluation for new features. It intentionally defers strict CI fail gates and fixed “major flow” monitoring. Delivery model is small, reviewable PR slices with measurable exits.

## Assumptions
1. Primary goal is visibility in each PR, not global regression blocking.
2. Scenario generation input is limited to PR diff and PR metadata.
3. Scenario hints are extracted from changed sections of `README.md`, `SPEC.md`, and `docs/` only.
4. Evaluation uses a two-stage flow: scenario preview first, execution only after reviewer approval.
5. Approval trigger is PR label `ux-eval-approved`.
6. Missing or low-confidence auto scenarios should produce a warning, not a hard failure.
7. GitHub PR comments are the first-class output channel and use sticky updates.

## PR0: Contract Freeze for PR UX Evaluation
Goal: Lock product behavior and acceptance contract for the revised scope.
Code and file changes:
1. Add `docs/pr_ux_evaluation_contract.md` with success criteria and non-goals.
2. Add `config/examples/pr-eval-sample.yml` for reference structure.
3. Add CLI docs section in `README.md` for PR evaluation workflow.
Tests:
1. Documentation sanity check by running sample command sequence end-to-end.
Exit criteria:
1. Team agrees on informational mode and metric set (`taskSuccessRate`, `medianTaskTimeMs`, `totalErrors`).

## PR1: Scenario Discovery Engine v1 (Auto-Generate)
Goal: Generate candidate scenarios from PR diff, PR context, and changed docs.
Code and file changes:
1. Add `src/scenario/discovery.ts` for git diff parsing and changed-surface extraction.
2. Add `src/scenario/pr-context.ts` to ingest PR title/body and changed file list.
3. Add `src/scenario/doc-hints.ts` to read only changed hunks in `README.md`, `SPEC.md`, and `docs/`.
4. Add `src/scenario/derive.ts` for mapping changed surfaces to task skeletons.
5. Add `src/scenario/confidence.ts` for confidence scoring and warning logic.
6. Add CLI command in `bin/fov.ts`: `fov discover --base <ref> --head <ref> --pr-metadata <json> --out <dir>`.
7. Write output to `artifacts/<run>/discovered-scenarios.yml`.
8. Render reviewer-facing summary to `artifacts/<run>/scenario-preview.md`.
Tests:
1. Unit tests for parser and mapper (`src/scenario/*.test.ts` when test harness is added).
2. Interim validation script with fixture diffs under `examples/`.
Exit criteria:
1. For representative PR diffs, tool emits scenario proposals with confidence and traceable source snippets.
2. Output clearly marks why a scenario was proposed from code/doc/PR context.

## PR2: Deterministic PR Evaluation Runner
Goal: Execute the same generated scenarios on base and candidate, then diff results.
Code and file changes:
1. Add command in `bin/fov.ts`: `fov pr-eval --base <ref> --head <ref> --scenario-file <path> --out <dir>`.
2. Reuse `run` and `compare` paths by orchestrating two runs and one diff.
3. Add approval gate input requiring PR label `ux-eval-approved` before execution.
4. Extend `src/types/report-data.ts` to include scenario provenance and confidence.
5. Extend `src/report/diff-report.ts` to show approved scenario metadata.
Tests:
1. Smoke test script for `discover -> preview -> approve -> run(base) -> run(head) -> compare`.
2. Validate deterministic behavior with fixed seed.
Exit criteria:
1. Evaluation runs only for approved scenarios and records approval provenance.
2. Single command sequence produces candidate report, baseline report, and diff report from one PR context.

## PR3: GitHub PR Comment Publisher
Goal: Publish machine-readable and human-readable UX summary directly to PR comments.
Code and file changes:
1. Add `scripts/post_pr_comment.mjs` to post/update sticky comment.
2. Add `scripts/render_pr_summary.mjs` to format scenario preview, approval state, metrics deltas, and report links.
3. Add GitHub Actions workflow `.github/workflows/pr-ux-eval.yml`.
4. Read PR labels in workflow and start evaluation only when `ux-eval-approved` is present.
Tests:
1. Dry-run mode that prints comment markdown locally.
2. Workflow test on internal sandbox repository.
Exit criteria:
1. Each PR receives one sticky comment with:
2. Proposed scenarios (with confidence/source),
3. Approval instructions (`ux-eval-approved` label),
4. Post-run summary and artifact links.

## PR4: Advisor Prioritization for Changed Surfaces
Goal: Tailor advisor output to changed feature area and show top actionable suggestions.
Code and file changes:
1. Extend `src/advisor.ts` to ingest changed-surface metadata.
2. Add ranking logic for Top 3 suggestions by severity and expected impact.
3. Persist rationale in `advisor-report.json`.
Tests:
1. Rule tests with synthetic session metrics fixtures.
2. Snapshot test for advisor output format.
Exit criteria:
1. PR comment includes concise “Findings / Hypothesis / Suggestions / Verification” with traceable evidence.

## PR5: Report UI Integration for PR-Centric Review
Goal: Improve report readability for reviewers evaluating one PR feature.
Code and file changes:
1. Update `report-ui/src/components/DiffSummary.tsx` and related components with changed-surface context.
2. Add advisor highlight panel in `report-ui/src/components/AdvisorPanel.tsx`.
3. Show scenario confidence and generation notes in UI.
Tests:
1. `cd report-ui && npm run build`.
2. Manual verification using generated artifact reports.
Exit criteria:
1. Reviewer can identify “what changed, what got better/worse, what to fix next” in under 5 minutes.

## PR6: M5 Lite Hardening (Stability and Runtime)
Goal: Reduce CI runtime noise and improve reproducibility.
Code and file changes:
1. Implement configurable concurrency and seed pinning in `src/runner.ts`.
2. Add flaky retry strategy with explicit labeling in metrics output.
3. Add runtime telemetry in `run-metrics.json`.
Tests:
1. Repeated-run variance check on same commit.
2. Runtime benchmark before/after.
Exit criteria:
1. Same commit produces stable trend direction across repeated runs.

## Dependency Graph
1. PR0 -> PR1 -> PR2 -> PR3.
2. PR4 depends on PR2 metadata and PR3 presentation channel.
3. PR5 depends on PR2 and PR4 data shape.
4. PR6 depends on PR2 baseline orchestration and can run in parallel with PR5 after PR2.

## Go/No-Go Checkpoints
1. Checkpoint A (after PR2): Go only if end-to-end flow supports preview and explicit reviewer approval before execution.
2. Checkpoint B (after PR3): Go only if sticky PR comment remains readable from preview to final result update.
3. Checkpoint C (after PR5): Go only if advisor and diff context improve triage speed in real PRs.
