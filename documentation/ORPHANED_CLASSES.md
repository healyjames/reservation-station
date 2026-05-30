# Orphaned CSS Classes

These classes appeared in `documentation/CSS_AUDIT_MAIN_BRANCH.md` but do not have a clear one-to-one home in the current Preact component tree.

- `.button` — superseded by the shared `Button` component and its CSS module variants; no current TSX renders a generic global `.button` class.
- `.booking-card-header` — current admin booking cards use `card-time-guests`, `card-name`, `card-dietary`, and `card-actions`; there is no dedicated header wrapper in the Preact card markup.
- `.booking-card-status`, `.booking-card-status.confirmed`, `.booking-card-status.pending`, `.booking-card-status.cancelled` — current admin reservation data/rendering does not expose a booking status pill, so there is nowhere to apply these state classes yet.
- `.page-container` — the current admin screens render directly inside the dashboard layout without a dedicated max-width page wrapper component.
- `.form-grid` — no current public/admin form component renders a generic multi-column `.form-grid` wrapper; layouts are handled either by component composition or existing admin-specific structures.

These were intentionally left documented rather than forced into unrelated components.
