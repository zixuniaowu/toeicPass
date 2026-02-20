# Repository Guidelines

## Project Structure & Module Organization
This repository is currently in bootstrap state, so keep new work organized from day one:
- `src/`: application code, grouped by feature (for example, `src/vocab/`, `src/quiz/`).
- `tests/`: automated tests mirroring `src/` paths.
- `assets/`: static files such as images, audio, or seed content.
- `scripts/`: local automation (setup, migration, data import).
- `docs/`: architecture notes and product decisions.

Keep modules small and focused. Prefer feature folders over large, mixed utility files.

## Build, Test, and Development Commands
Standardize local workflows with package scripts (or equivalent task runner) and keep names stable:
- `npm install`: install dependencies.
- `npm run dev`: start local development mode.
- `npm run build`: create a production build.
- `npm test`: run the full test suite.
- `npm run lint`: run static checks.

If you introduce a different toolchain, provide equivalent commands and update this file in the same PR.

## Coding Style & Naming Conventions
- Use 2-space indentation for JS/TS, JSON, and YAML.
- Use `camelCase` for variables/functions, `PascalCase` for classes/components, and `kebab-case` for file names (for example, `quiz-session.ts`).
- Keep functions single-purpose and avoid hidden side effects.
- Format and lint before committing (`npm run lint` and formatter command if configured).

## Testing Guidelines
- Place tests under `tests/` with names like `feature-name.spec.ts` or `feature-name.test.ts`.
- Mirror source paths where practical (for example, `src/quiz/session.ts` -> `tests/quiz/session.spec.ts`).
- Add or update tests for every behavior change and bug fix.
- Aim for meaningful coverage on core flows (quiz scoring, answer validation, progress tracking).

## Commit & Pull Request Guidelines
- Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Keep commits focused; avoid mixing refactors with behavior changes.
- PRs should include: what changed, why, how to test, and linked issue/task.
- Add screenshots or sample output when UI/UX behavior changes.
