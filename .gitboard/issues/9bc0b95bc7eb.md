---
id: 9bc0b95bc7eb
title: "ADR: Client-side SPA rendering"
status: accepted
project: ADR
type: story
priority: high
labels: []
createdAt: 2026-11-14T17:24:30.506Z
updatedAt: 2026-11-14T17:27:49.363Z
---

## Context

GitHub Pages requires static output. Decided in the stack ADR to use a Vite SPA.

## Decision

Client-side rendered SPA built with `vite build`. Routing approach (hash vs history + 404 fallback) to be decided with the first routed feature.

## Acceptance Criteria

- [x] Strategy decided
