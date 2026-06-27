---
name: add-new-feature-with-ui-modal-or-tab
description: Workflow command scaffold for add-new-feature-with-ui-modal-or-tab in scribeflow.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-new-feature-with-ui-modal-or-tab

Use this workflow when working on **add-new-feature-with-ui-modal-or-tab** in `scribeflow`.

## Goal

Implements a new feature that introduces a new modal dialog or inspector tab in the UI, with supporting logic in App.tsx and a new component file.

## Common Files

- `src/App.tsx`
- `src/components/*Modal.tsx`
- `src/components/Inspector.tsx`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create a new component file for the modal or tab (e.g., StatisticsModal.tsx, TargetsModal.tsx).
- Update App.tsx to include state and handlers for the new modal/tab and render it conditionally.
- Wire up UI triggers (buttons, toolbar, etc.) to open the modal/tab.
- If necessary, update related CSS or shared logic.
- Test integration with existing data models (no schema change needed).

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.