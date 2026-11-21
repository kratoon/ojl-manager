# Agent instructions

## Git

- Changes that touch **only** files under `.gitboard/` (issues, ADRs, board config) may be committed and pushed directly to `main`, without a branch or PR and without asking first.
- Everything else (code, config, CI, docs, `.claude/`, `.agents/`) goes through a branch and a pull request, and needs the user's go-ahead to commit.
- If a change mixes `.gitboard/` files with anything else, do not push it to `main`: use a branch and PR for the whole change.
- Use the Gitboard CLI to change `.gitboard/` files (see the gitboard skill); never edit them by hand.

## Commits, PRs and releases (ADR-ca37db3)

- PR titles (and so squash-merge commits) must follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `build:`, `ci:`, `chore:`, `revert:`; add `!` for breaking changes. CI rejects other titles.
- `feat` bumps the minor version, `fix`/`perf` the patch. Commits pushed straight to `main` for `.gitboard/` changes use `chore:`.
- Never bump `package.json` `version` or edit `CHANGELOG.md` by hand: release-please does it through its release PR. The version is shown in the UI and written into saved data files.
