---
name: gitboard
description: Track and manage tasks, issues, stories and epics for the current repository with the gitboard CLI. Use when asked to create, find, update, prioritise, move or close tasks, to plan or break down work, or when starting or finishing work that should be recorded on the project board.
---

# Gitboard: task tracking through the CLI

Gitboard stores issues as Markdown files in the repository (`.gitboard/issues/<id>.md`). **Always use the
`gitboard` CLI to read and change issues. Do not edit, create, rename or delete those files by hand**, and
do not write your own parsing or id-generation code: the CLI validates everything and keeps files
consistent. The web UI is optional and does not need to be running.

Always pass `--json` and read the result. Never rely on interactive prompts: pass every value as a flag.

```bash
gitboard issue list --json
```

Successful output is `{ "ok": true, "data": ... }`. Failures are `{ "ok": false, "error": { "code", "message" } }`
with a non-zero exit code:

| Exit | Meaning |
|---|---|
| 0 | success |
| 2 | bad usage or missing input (a flag is missing or invalid) |
| 3 | not found (issue, project, repository) |
| 4 | validation failed (invalid status, bad parent, `validate` found problems) |
| 5 | conflict (the file changed on disk, or customised skill files) |
| 6 | not inside a repository with Gitboard (`gitboard init` first) |

If the repository is not initialised, ask the user before running `gitboard init`.

## Concepts

- **Repository**: the Git repo you are working in. Gitboard detects it from the current directory.
- **Project**: a group of issues with a short uppercase **key** (for example `AUTH`). Every issue belongs to
  one project. List them with `gitboard project list --json`.
- **Epic**: an issue with `--type epic` that groups stories. A story links to its epic with `--parent <epic>`.
  Epics cannot be nested, and a story and its epic must be in the same project.
- **Status**: the column an issue is in. Each project has its own valid statuses (default `todo`,
  `in-progress`, `done`); columns flagged done hold finished work. Check them with `gitboard columns show --project KEY --json` and never invent one.
- **Issue reference**: use the `ref` field from the JSON (for example `AUTH-a3f91c2`), a short id prefix, or
  the full 12-character `id`. Always write the `ref` in commit messages, comments and pull requests so people
  can find the issue.

## When to create an issue

- The user asks you to track, plan, or break down work.
- You discover a bug, follow-up or task during your work that you will not finish now.
- A large request needs splitting: create an epic and a story per deliverable.

Search first so you do not create duplicates, and do not create issues for trivial steps you will complete
immediately.

```bash
gitboard issue list --json                         # everything
gitboard issue list --status in-progress --json    # filter: --project --status --label --priority --type --parent
gitboard issue list -q "login" --json              # search titles, bodies and ids
gitboard issue show AUTH-a3f91c2 --json            # one issue; epics include children and progress
gitboard board --json                              # columns with their issues, per project
gitboard backlog --json                            # open work as a list grouped by status (--all adds done)
```

## Creating issues

```bash
gitboard issue create "Implement authentication service" \
  --project AUTH --priority high --label backend --label api \
  --body $'## Description\n\nImplement the authentication service.\n\n## Acceptance Criteria\n\n- [ ] Users can sign in\n- [ ] Unit tests added\n' \
  --json
```

- `--project` is required when the repository has more than one project.
- Priorities: `low`, `medium`, `high`, `urgent`. Types: `story` (default) and `epic`.
- Longer bodies: write them to a file and pass `--body-file path.md`, or pipe with `--stdin`.
- Epic with stories: `gitboard issue create "Checkout" --type epic --project SHOP --json`, then
  `gitboard issue create "Cart service" --project SHOP --parent <epic ref> --json`.

Keep titles short and specific. Put the detail in the body with a `## Description` and an
`## Acceptance Criteria` section made of `- [ ]` checklist items.

## Updating issues

```bash
gitboard issue update AUTH-a3f91c2 --priority urgent --add-label security --remove-label backend --json
gitboard issue update AUTH-a3f91c2 --title "New title" --json
gitboard issue update AUTH-a3f91c2 --parent AUTH-9b1c0de --json    # attach to an epic (--no-parent removes it)
gitboard issue update AUTH-a3f91c2 --body-file notes.md --json     # replaces the whole body
```

`--body`/`--body-file` replace the entire body, so run `issue show` first and send the complete text.

## Changing status

```bash
gitboard issue move AUTH-a3f91c2 in-progress --json     # when you start working on it
gitboard issue move AUTH-a3f91c2 done --json            # when it is finished and verified
gitboard issue move AUTH-a3f91c2 --top --json           # reorder within the column (also --bottom, --before <ref>, --after <ref>)
```

Move an issue to `in-progress` when you start it and to the project's final column only when the work is
complete, tests pass, and every acceptance criterion is satisfied.

## Acceptance criteria

Tick items as you complete them instead of editing the body:

```bash
gitboard issue check AUTH-a3f91c2 2 --json              # check item 2 (1-based, in order of appearance)
gitboard issue check AUTH-a3f91c2 2 --uncheck --json
```

Use `issue show` to see numbered checklist items. If you find missing criteria, update the body with the full
new text.

## Validation and housekeeping

```bash
gitboard validate --json    # exit code 4 lists problems: bad ids, unknown statuses, broken parents, ...
gitboard status --json      # current Git branch and uncommitted .gitboard changes
```

Run `gitboard validate` after you or a teammate have edited issue files directly or resolved merge conflicts,
and fix the reported problems with CLI commands.

## Git

Gitboard **never commits, pushes or merges**. Its changes are ordinary file changes on the current branch:

- Commit `.gitboard/` changes together with the related code, or when the user asks you to commit.
- Issues exist on the branch where they were created until that branch is merged.
- Do not create commits or branches only for board changes unless asked.

## Rules of thumb

- Prefer the CLI to touching `.gitboard/` files. If a command fails, read the error message and fix the input
  rather than working around it by editing files.
- On exit code 5 (conflict) run `gitboard issue show <ref> --json` again and retry with fresh data.
- Never delete issues unless the user asks. `gitboard issue delete <full id> --yes` needs the full 12-character
  id and removes the file.
- Do not change columns (`gitboard columns set`) or projects without the user's agreement.
