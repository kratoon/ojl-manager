---
id: d505cb7c8ecd
title: "ADR: Vite + React + TypeScript, no Next.js"
status: accepted
project: ADR
type: story
priority: urgent
labels: []
createdAt: 2026-11-14T17:24:30.259Z
updatedAt: 2026-11-14T17:27:49.123Z
---

## Context

Requested stack was Next + Vite + TypeScript, but Next.js has its own bundler and overlaps with Vite. The sibling project `kratoon/gitboard` uses Vite + React + TypeScript (no Next.js).

## Decision

Follow gitboard: **Vite + React + TypeScript** SPA. No Next.js.

## Consequences

- Single bundler (Vite), Vitest for tests.
- Static build output, which fits GitHub Pages.

## Acceptance Criteria

- [x] Role of each tool decided
- [x] Decision accepted
