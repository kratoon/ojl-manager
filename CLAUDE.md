# Agent instructions

## Git

- Changes that touch **only** files under `.gitboard/` (issues, ADRs, board config) may be committed and pushed directly to `main`, without a branch or PR and without asking first.
- Everything else (code, config, CI, docs, `.claude/`, `.agents/`) goes through a branch and a pull request, and needs the user's go-ahead to commit.
- If a change mixes `.gitboard/` files with anything else, do not push it to `main`: use a branch and PR for the whole change.
- Use the Gitboard CLI to change `.gitboard/` files (see the gitboard skill); never edit them by hand.
