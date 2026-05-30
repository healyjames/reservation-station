# Legacy frontend removal

_Date: 2026-05-27_

## Removed files

### Legacy booking widget
- `public/index.html`
- `public/js/booking-form.js`
- `public/js/calendar-core.js`
- `public/js/calendar.js`
- `public/js/tenants.js`

These files powered the old vanilla booking flow. They are replaced by the Preact booking surfaces in `src/frontend/index.html` and `src/frontend/booking-widget/`.

### Legacy booking management + cancel flows
- `public/booking/manage/index.html`
- `public/js/manage-booking.js`
- `public/js/cancel.js`

These flows now ship from `src/frontend/booking/manage/` and `src/frontend/cancel/`.

### Legacy admin pages
- `public/admin/index.html`
- `public/admin/dashboard.html`
- `public/admin/settings.html`
- `public/admin/js/auth.js`
- `public/admin/js/booking-modal.js`
- `public/admin/js/dashboard.js`
- `public/admin/js/date-picker.js`
- `public/admin/js/settings-page.js`
- `public/admin/js/settings.js`

These pages and scripts were replaced by the Preact admin surface in `src/frontend/admin/`.

## Kept assets
- `public/styles.css`
- `public/shared.css`
- `public/admin/styles/admin.css`
- `public/js/theme.js`
- `public/fonts/*`

These files are still referenced by the current Preact HTML entries and remain part of the deployed static asset set.

## Build verification
- `npm run build` passes after the cleanup.
