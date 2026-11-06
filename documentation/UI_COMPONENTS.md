# UI components

Owned daisyUI-backed Preact components in `src/frontend/shared/components/ui/`. Import them from `@shared/components/ui`.

Conventions: see "UI components" in `.claude/docs/architecture.md` (added in subtask 5). Build new ones with `/ui-component <daisyUI name>` (added in subtask 5). Props lists names only; the source is the reference.

| Component | daisyUI category | Props | Consumers |
| --- | --- | --- | --- |
| Loading | Feedback ([loading](https://daisyui.com/components/loading/)) | `variant`, `size`, `label` (`null` = decorative), `<span>` attributes | none yet (replaces `Spinner`) |
