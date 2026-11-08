# UI components

Owned daisyUI-backed Preact components in `src/frontend/shared/components/ui/`. Import them from `@shared/components/ui`.

Conventions: see "UI components" in `.claude/docs/architecture.md`. Build new ones with `/ui-component <daisyUI name>`. Props lists names only; the source is the reference.

| Component | daisyUI category | Props | Consumers |
| --- | --- | --- | --- |
| Loading | Feedback ([loading](https://daisyui.com/components/loading/)) | `size`, `label` (`null` or `''` = decorative), `<span>` attributes | ui/Button (replaces `Spinner`) |
| Button | Actions ([button](https://daisyui.com/components/button/)) | `variant` (primary, secondary = neutral outline, error, ghost), `size` (sm, md), `shape` (square, circle), `block`, `isLoading`, `type` (default `button`), `<button>` attributes | none yet (replaces `Button`) |
| Icons (`ui/icons/`, import from `@shared/components/ui/icons`, not the ui barrel) | none (inline SVG adapted from [Lucide](https://lucide.dev) v0.460.0, ISC) | `title` (accessible name for a standalone meaningful icon; without it the icon is `aria-hidden`. Inside a button, name the button instead), `size` (px; default `1em`, the surrounding text size), `<svg>` attributes. Exposes `data-icon="<lucide-name>"`. Icons: ArrowLeft, ArrowRight, CalendarDays, CalendarX, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Clock, Info, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Pencil, Plus, RefreshCw, SlidersHorizontal, Sun, Trash2, X | none yet (replaces the Unicode glyph icons and the `Login`/`MessageCard` inline SVGs) |
