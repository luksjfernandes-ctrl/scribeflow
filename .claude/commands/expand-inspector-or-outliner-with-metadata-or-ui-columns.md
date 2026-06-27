---
name: expand-inspector-or-outliner-with-metadata-or-ui-columns
description: Workflow command scaffold for expand-inspector-or-outliner-with-metadata-or-ui-columns in scribeflow.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /expand-inspector-or-outliner-with-metadata-or-ui-columns

Use this workflow when working on **expand-inspector-or-outliner-with-metadata-or-ui-columns** in `scribeflow`.

## Goal

Adds new metadata fields or UI columns (such as keywords, progress bars, or colored dots) to the Inspector or Outliner, updating both the UI and the underlying data handling.

## Common Files

- `src/components/Inspector.tsx`
- `src/components/Outliner.tsx`
- `src/App.tsx`
- `src/index.css`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Update Inspector.tsx or Outliner.tsx to add new UI elements (tabs, columns, chips, dots, etc.).
- Update App.tsx if shared state or handlers are needed.
- If new metadata is exposed, ensure it is read from the existing data model (no schema change).
- Update CSS for new UI elements.
- Test that new metadata or visual indicators display and update correctly.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.