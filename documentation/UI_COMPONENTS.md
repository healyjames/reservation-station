# UI components

Owned daisyUI-backed Preact components in `src/frontend/shared/components/ui/`. Import them from `@shared/components/ui`.

Conventions: see "UI components" in `.claude/docs/architecture.md`. Build new ones with `/ui-component <daisyUI name>`. Props lists names only; the source is the reference.

| Component | daisyUI category | Props | Consumers |
| --- | --- | --- | --- |
| Loading | Feedback ([loading](https://daisyui.com/components/loading/)) | `size`, `label` (`null` or `''` = decorative), `<span>` attributes | ui/Button (replaces `Spinner`) |
| Button | Actions ([button](https://daisyui.com/components/button/)) | `variant` (primary, secondary = neutral outline, error, ghost), `size` (sm, md), `shape` (square, circle), `block`, `isLoading`, `type` (default `button`), `<button>` attributes | none yet (replaces `Button`) |
