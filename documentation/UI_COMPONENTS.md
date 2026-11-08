# UI components

Owned daisyUI-backed Preact components in `src/frontend/shared/components/ui/`. Import them from `@shared/components/ui`.

Conventions: see "UI components" in `.claude/docs/architecture.md`. Build new ones with `/ui-component <daisyUI name>`. Props lists names only; the source is the reference.

| Component | daisyUI category | Props | Consumers |
| --- | --- | --- | --- |
| Loading | Feedback ([loading](https://daisyui.com/components/loading/)) | `size`, `label` (`null` or `''` = decorative), `<span>` attributes | ui/Button (replaces `Spinner`) |
| Button | Actions ([button](https://daisyui.com/components/button/)) | `variant` (primary, secondary = neutral outline, error, ghost), `size` (sm, md), `shape` (square, circle), `block`, `isLoading`, `type` (default `button`), `<button>` attributes | none yet (replaces `Button`) |
| Icons (`ui/icons/`, import from `@shared/components/ui/icons`, not the ui barrel) | none (inline SVG adapted from [Lucide](https://lucide.dev) v0.460.0, ISC) | `title` (accessible name for a standalone meaningful icon; without it the icon is `aria-hidden`. Inside a button, name the button instead), `size` (px; default `1em`, the surrounding text size), `<svg>` attributes. Exposes `data-icon="<lucide-name>"`. Icons: ArrowLeft, ArrowRight, CalendarDays, CalendarX, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Clock, Info, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Pencil, Plus, RefreshCw, SlidersHorizontal, Sun, Trash2, X | none yet (replaces the Unicode glyph icons and the `Login`/`MessageCard` inline SVGs) |
| Alert | Feedback ([alert](https://daisyui.com/components/alert/)) | `variant` (info, success, warning, error; soft tint with `base-content` text and a full status-colour border, not daisyUI's raw `alert-soft` text, which fails contrast on light themes), `title` + `headingLevel` (required with `title`: 2, 3, 4, or `null` for bold text that is not a heading), `icon` (default on, decorative, status colour), `action`, `live` (`assertive` = `role=alert`, `polite` = `role=status`, omitted = static), `<div>` attributes | ui/icons (replaces `Alert`, `MessageCard` and the inline yellow warnings in `Calendar`/`Step1Form`) |
