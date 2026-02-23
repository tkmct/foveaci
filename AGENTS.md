# Repository Guidelines

## Project Structure & Module Organization
- `bin/fov.ts`: CLI entrypoint (`fov` command).
- `src/`: core TypeScript engine (config loading, runner, recording, metrics, diff/advisor logic).
- `src/behavior/`: human-like interaction primitives (`mouse.ts`, `typing.ts`).
- `src/report/` + `src/report/static/`: report generation and embedded static viewer assets.
- `report-ui/`: React + Vite report UI source (`src/components`, `src/hooks`, `src/theme`), built and copied into `src/report/static/`.
- `config/examples/`: runnable YAML configs (`basic.yml`, `strict-gates.yml`).
- `examples/miniapp/`: local sample target app for smoke testing.
- `artifacts/`, `dist/`, `node_modules/`: generated outputs; do not commit.

## Build, Test, and Development Commands
- `pnpm install`: install dependencies (root).
- `npx playwright install chromium`: install browser runtime required by the runner.
- `pnpm build`: build `report-ui`, compile TS, and package report static assets into `dist/`.
- `pnpm fov run --config ./config/examples/basic.yml --out ./artifacts/run1`: execute a sample run.
- `cd report-ui && npm run dev`: run report UI locally with Vite.
- `cd report-ui && npm run build`: type-check and build UI bundle.

## Coding Style & Naming Conventions
- Language: strict TypeScript (`tsconfig.json` and `report-ui/tsconfig.json` both enable `strict`).
- Follow existing formatting: 2-space indentation, double quotes, semicolons, trailing commas where applicable.
- Keep modules focused and composable; prefer small pure helpers in `src/`.
- Naming patterns:
  - React components: `PascalCase.tsx` (for example `ReplayViewer.tsx`)
  - Hooks: `useX.ts` (for example `useReplayEngine.ts`)
  - Core modules/utilities: lowercase descriptive filenames (for example `metrics.ts`)

## Testing Guidelines
- No dedicated automated test suite is defined yet. Treat build + scenario runs as required validation.
- Minimum pre-PR checks:
  1. `pnpm build`
  2. Run at least one config (`basic.yml` or `strict-gates.yml`) and verify outputs in `artifacts/<run>/`.
- For UI changes, also run `cd report-ui && npm run build` and verify report rendering.

## Commit & Pull Request Guidelines
- Use short, imperative commit subjects consistent with history (for example `Fix replay UI`).
- Keep each commit scoped to one logical change.
- PRs should include: purpose, key implementation notes, validation commands run, and impacted paths.
- Attach screenshots for `report-ui` visual changes and link related issues/tasks when available.
