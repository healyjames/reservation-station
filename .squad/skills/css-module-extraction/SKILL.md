---
name: "css-module-extraction"
description: "Extract global CSS rules for a TSX component into a scoped CSS module, rename classes to be simple and consistent, update the TSX file to use module syntax."
domain: "css, frontend, refactoring"
confidence: "high"
source: "earned"
---

## Context

Used when a TSX component references global CSS classes defined in `public/shared.css` or `public/styles.css`. The goal is to give each component its own scoped `.module.css` file so styles don't bleed, and to clean up class names in the process.

This was established during the BookingWidget CSS modularisation sprint (Calendar, Step1Form, Step2Form, Success).

---

## Process

Given a file path to a TSX component, follow these steps in order:

### 1. Read the component

Open the TSX file. Collect every string that appears in a `class=` or `className=` attribute — these are the global class names to look up.

### 2. Search the global CSS sources

Search **both** of these files for each class name:
- `public/shared.css`
- `public/styles.css`

For each rule found, copy it verbatim. Also copy any nested rules (pseudo-classes, pseudo-elements, child selectors e.g. `.my-class p { ... }`), `@media` blocks that scope to the class, and any `@keyframes` referenced by the class's `animation` property.

### 3. Check for shared usage

Before treating a rule as component-exclusive, search the rest of the codebase for each class name:

```
grep -r "class-name" src/
```

**If a class is used in other TSX files:** do NOT remove it from the global CSS. Still add the equivalent rule to the module (the component will use the module version), but leave the global intact for the other consumers.

**If a class is only used in this component:** it is a candidate for eventual removal from global CSS (but do not remove it in this task — leave that to the user).

### 4. Decide on the module class names

Rename every class using these rules:

- Use the **simplest meaningful name** that describes the element's role in this component.
- Prefer a short hierarchy: `container` → `inner` → `heading`, `form`, `nav`, `btn`, etc.
- If a name needs more than one word, use **underscores**: `close_btn`, `step_indicator`, `loading_indicator`, `inline_helper`.
- **Never use camelCase** for CSS module class names.
- Map pseudo-classes and child selectors to the new name automatically (e.g. `.my-class:hover` → `.close_btn:hover`).

Keep a mental mapping: `old-global-name` → `new-module-name`. You'll need it when updating the TSX.

### 5. Create or update the CSS module file

The module file lives next to the component: `{ComponentName}.module.css`

- If it **does not exist**, create it.
- If it **already exists**, append new rules (do not overwrite — other classes may already be there).

Write rules in this order:
1. Layout / container rules (`.container`, `.inner`, `.form`, `.nav`)
2. Interactive element rules (`.btn`, `.close_btn`, `.back_btn`)
3. State/variant rules (`.step_indicator`, `.loading_indicator`, `.inline_helper`, `.inline_helper_error`)
4. Pseudo-class and child selector rules (`.close_btn:hover`, `.loading_indicator p`)
5. `@media` blocks
6. `@keyframes` (always at the end)

Only include `@keyframes` if that animation is referenced by a class in this module. Do not duplicate `@keyframes` blocks that are already in the file.

### 6. Update the TSX file

At the top of the file, add the import (if not already present):

```tsx
import styles from './{ComponentName}.module.css';
```

Replace every global class reference using the mapping from step 4:

| Before | After |
|--------|-------|
| `class="old-global-name"` | `class={styles.new_module_name}` |
| `class="foo bar"` (two classes) | `class={\`${styles.foo} ${styles.bar}\`}` |

For conditional classes, preserve the logic and just swap the string reference:
```tsx
// Before
class={isError ? 'inline-helper inline-helper-error' : 'inline-helper'}

// After
class={isError ? `${styles.inline_helper} ${styles.inline_helper_error}` : styles.inline_helper}
```

---

## Naming reference

Common mappings used in this project:

| Global class | Module name |
|---|---|
| `booking-form-content` | `content` |
| `calendar-container` | `container` |
| `calendar-header` | `header` |
| `calendar-nav` | `nav` |
| `calendar-close-btn` | `close_btn` |
| `calendar-nav-btn` | `back_btn` |
| `step-indicator` | `step_indicator` |
| `loading-indicator` | `loading_indicator` |
| `inline-helper` | `inline_helper` |
| `inline-helper-error` | `inline_helper_error` |

These are starting points — always choose the name that makes most sense for the specific component.

---

## CSS variable rules

All CSS values MUST use design tokens from `public/shared.css`. Never hardcode colours, spacing, or radii. Common tokens:

```
Spacing:  --space-2, --space-3, --space-4, --space-6
Radii:    --radius-xs, --radius-sm, --radius-md
Colours:  --primary, --primary-lighter, --primary-lightest
          --background, --background-light, --background-lighter, --background-lightest
          --background-darker
          --foreground, --foreground-lightest
          --error
```

If an existing global rule references a token that doesn't exist, substitute the nearest valid token (prefer `--background-lighter` over `--background-light` when the difference is minor). Don't invent new tokens.

---

## Anti-Patterns

- **Do not remove global rules** that are still used by other components. Only the component you're working on switches to module syntax.
- **Do not use camelCase** in CSS module class names (`closeBtn` ❌, `close_btn` ✅).
- **Do not duplicate `@keyframes`** that are already defined in the same module file.
- **Do not inline arbitrary values** — if there's no matching token, check `shared.css` before hardcoding.
- **Do not rename classes to match their visual appearance** — name them by their structural role in the component (`nav`, not `blue-bar`).
- **Do not add new CSS rules** that didn't exist in the globals. This task is extraction and renaming only.

---

## Example

**Input:** `src/frontend/shared/components/BookingWidget/Success.tsx`

Uses: `booking-form-content`

Global rule in `styles.css`:
```css
.booking-form-content {
  animation: slideIn 0.3s ease-out;
  padding: var(--space-6);
}
@keyframes slideIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Output — `Success.module.css`:**
```css
.content {
  animation: slideIn 0.3s ease-out;
  padding: var(--space-6);
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Output — `Success.tsx` change:**
```tsx
// Before
import type { FunctionComponent } from 'preact';
// ...
<div class="booking-form-content">

// After
import styles from './Success.module.css';
// ...
<div class={styles.content}>
```
