```markdown
# scribeflow Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches the core development conventions and workflows for contributing to the `scribeflow` codebase—a TypeScript project using the Vite framework. The repository focuses on a modular UI, with patterns for adding features like modals, inspector tabs, and metadata columns. You'll learn how to extend the UI, maintain code consistency, and follow established commit and testing practices.

## Coding Conventions

- **File Naming:**  
  Use PascalCase for component and module files.  
  _Example:_  
  ```
  src/components/StatisticsModal.tsx
  src/components/Outliner.tsx
  ```

- **Import Style:**  
  Use relative imports for internal modules.  
  _Example:_  
  ```typescript
  import { StatisticsModal } from './StatisticsModal';
  import { Outliner } from '../Outliner';
  ```

- **Export Style:**  
  Use named exports for components and utilities.  
  _Example:_  
  ```typescript
  // In StatisticsModal.tsx
  export function StatisticsModal(props: Props) { ... }
  ```

- **Commit Messages:**  
  Follow the Conventional Commits style.  
  - Prefixes: `feat`, `chore`
  - Example:  
    ```
    feat: add progress bar to Outliner panel
    chore: update dependencies
    ```

## Workflows

### Add New Feature with UI Modal or Tab
**Trigger:** When adding a major feature that requires a new modal dialog or inspector tab in the UI.  
**Command:** `/new-modal-feature`

1. **Create a new component file** for the modal or tab.  
   _Example:_  
   ```
   src/components/StatisticsModal.tsx
   ```
2. **Update `App.tsx`** to include state and handlers for the new modal/tab, and render it conditionally.
   ```typescript
   // In App.tsx
   const [showStatistics, setShowStatistics] = useState(false);

   <button onClick={() => setShowStatistics(true)}>Show Statistics</button>
   {showStatistics && <StatisticsModal onClose={() => setShowStatistics(false)} />}
   ```
3. **Wire up UI triggers** (e.g., buttons or toolbar items) to open the modal/tab.
4. **Update related CSS** or shared logic if needed.
5. **Test integration** with existing data models (no schema change required).

### Expand Inspector or Outliner with Metadata or UI Columns
**Trigger:** When surfacing new metadata or visual indicators in the Inspector or Outliner panels.  
**Command:** `/add-inspector-outliner-field`

1. **Update `Inspector.tsx` or `Outliner.tsx`** to add new UI elements (tabs, columns, chips, dots, etc.).
   ```typescript
   // In Outliner.tsx
   <td>
     <span className="keyword-chip">{item.keyword}</span>
   </td>
   ```
2. **Update `App.tsx`** if shared state or handlers are needed.
3. **Expose new metadata** from the existing data model if necessary.
4. **Update CSS** for new UI elements.
   ```css
   .keyword-chip {
     background: #e0e0e0;
     border-radius: 8px;
     padding: 2px 8px;
     font-size: 0.85em;
   }
   ```
5. **Test** that new metadata or visual indicators display and update correctly.

### Add Keyword or Progress UI to Multiple Views
**Trigger:** When displaying the same metadata (keywords, progress) across multiple UI panels.  
**Command:** `/add-metadata-to-views`

1. **Update each relevant component** (`Binder.tsx`, `Corkboard.tsx`, `Outliner.tsx`, `Inspector.tsx`) to render the new UI element.
   ```typescript
   // In Binder.tsx
   <div className="progress-bar" style={{ width: `${item.progress}%` }} />
   ```
2. **Ensure color/label logic** is consistent across components.
3. **Update shared CSS** for visual consistency.
   ```css
   .progress-bar {
     height: 6px;
     background: linear-gradient(to right, #4caf50, #81c784);
     border-radius: 3px;
   }
   ```
4. **Test metadata display** in all updated views.

## Testing Patterns

- **Test Files:**  
  Test files follow the `*.test.*` naming pattern and are located alongside the modules they test.  
  _Example:_  
  ```
  src/components/Outliner.test.tsx
  ```
- **Framework:**  
  The specific testing framework is not detected, but typical patterns suggest using Jest or Vitest for TypeScript/Vite projects.
- **Test Style:**  
  Tests are written per component or feature, focusing on UI rendering and logic.

## Commands

| Command                    | Purpose                                                          |
|----------------------------|------------------------------------------------------------------|
| /new-modal-feature         | Start a new feature with a modal dialog or inspector tab         |
| /add-inspector-outliner-field | Add metadata fields or UI columns to Inspector or Outliner panels |
| /add-metadata-to-views     | Add keyword/progress UI to Binder, Corkboard, Outliner, Inspector |
```
