---
id: e8f59cad5cf5
title: "ADR: Permission checks and view/edit display modes"
status: accepted
project: ADR
type: story
priority: high
labels: []
createdAt: 2026-11-14T18:09:13.191Z
updatedAt: 2026-11-14T18:09:20.549Z
---

## Context

The app handles sensitive data and will run in two situations: locally for the single editor, and (possibly later) hosted for many viewers. How edit access is unlocked when hosted is deferred (ADR-112163d). The app needs one consistent model so no feature ships without an access decision.

## Decision

- The app has two **display modes**: `view` and `edit`.
- **Localhost is always `edit`** (hostnames `localhost`, `127.0.0.1`, `[::1]`, `*.localhost`).
- Any other host defaults to `view`. How a hosted session may switch to `edit` is NOT decided here (see ADR-112163d).
- **Every feature must declare and check a permission**: `<feature>:view` to see it, `<feature>:edit` to change it. Mode `view` grants all `:view` permissions; mode `edit` grants `:view` and `:edit`.
- Checks are applied at every entry point: routes (a page without access shows a no-access message), menu entries (hidden without access) and every edit control (hidden without access).
- Any write path must enforce the same rule outside the UI too. The local data API exists only in the dev server (bound to 127.0.0.1) and rejects requests from foreign origins.
- A new route cannot be added without a permission; a test enforces that.

## Consequences

- UI checks are for usability only, not security. In a static hosted app they cannot protect data; protection belongs to the hosting/auth decision.
- Finer-grained roles (more than view/edit) can be added later by extending the permission set.

## Acceptance Criteria

- [x] Two display modes, localhost always edit
- [x] Every feature requires a view or edit permission
- [x] Hosted edit unlock explicitly left open (ADR-112163d)
