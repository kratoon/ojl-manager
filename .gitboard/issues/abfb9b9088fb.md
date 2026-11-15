---
id: abfb9b9088fb
title: "ADR: Temporary worker as a reserved assignment"
status: accepted
project: ADR
type: story
priority: medium
labels: []
createdAt: 2026-11-15T12:44:07.093Z
updatedAt: 2026-11-15T12:44:11.878Z
---

## Context

A shift may be covered by someone who is not an employee and not tracked (brigádník, external help, OJL-b8cdc86). The engine must treat the seat as taken and never fill or replace it.

## Decision

- **Reserved id**: a temporary worker is an assignment with the reserved `employeeId` `temporary` (`TEMPORARY_ID`), not a new assignment kind. It keeps every existing file valid and touches little code. No employee can have this id.
- **Always locked**: the schema requires `source: manual` for it. The shift dialog offers it in every seat select, shows a disabled locked padlock and no unlock toggle. Month unlock leaves it locked; clearing the shift removes it.
- **Several per shift**: unlike an employee it may take any number of seats, so two temporary workers can fill a shift.
- **Not an employee**: no name, partner, entitlement or rule warnings; it is skipped in fairness, day/night counts, month totals, the preview totals and the PDF footer. The calendar tile and the PDF show the label "Brigádník" (the PDF without a lock icon, as for everybody).
- **Generator**: regenerate keeps it (it is manual) and counts the seat as filled, so only the remaining seats are generated.
- **Who it replaced is not recorded**: the generator does not know which employee a temporary worker stands in for. That employee simply has one shift less, so like any absence the fairness rules may give them a shift back later. Linking a temporary worker to the replaced employee (to skip that make-up) is not done.
- **Pairs**: the other seat is filled as usual; the rotation treats the temporary worker as a locked seat and does not move the displaced employee's partner.

## Acceptance Criteria

- [x] Reserved id, always manual, several allowed per shift
- [x] Excluded from fairness, counts, totals and warnings
- [x] Decision accepted
