# Preact + TypeScript Migration Analysis

**Prepared by:** Han (Lead), Twinkie (Frontend), Sean (Backend)
**Requested by:** James Healy
**Date:** 2026-05-22
**Status:** Analysis complete — awaiting James's decision

---

## Executive Summary

**Go ahead. The migration is feasible, low-risk at the architectural level, and the DX/type-safety payoff is real.**

The codebase has ~1,500+ lines of vanilla frontend JS with zero TypeScript coverage. The imperative DOM-mutation pattern (manually re-rendering `innerHTML`, re-attaching event listeners after every state change, four copies of `escapeHtml`, three copies of `generateSlots`) is showing its costs. Preact is the right framework choice: James already knows the React API, Preact is binary-compatible with it, and at ~3KB gzipped it's 1/15th the bundle size of React — critical for an embeddable widget.

The backend (Hono on Cloudflare Workers + D1) needs **zero changes**. Every endpoint already returns pure JSON. The main upfront cost is introducing a Vite build pipeline; once that's in place the migration can proceed surface by surface.

---

## 1. Is It Worth Doing?

### Benefits

| Benefit | Detail |
|---|---|
| **Type safety** | Zero TS coverage on ~1,500 lines of frontend JS today. The backend has full Zod schemas for `Reservation`, `Tenant`, `BlockedDate`, `OpeningHoursEntry` — they can be shared into the frontend as TypeScript types. |
| **Eliminate duplication** | 4 copies of `escapeHtml`, 3 copies of `generateSlots`/`getSlotsForDate`, 2 copies of `formatDate`, 2 copies of the blocked-date tooltip. These collapse to single shared implementations. |
| **State management** | The current code re-renders entire HTML subtrees via `container.innerHTML = \`...\`` and re-attaches all event listeners after each render. React-style reconciliation eliminates this entire category of bugs (stale listeners, double-attach, missed re-renders). |
| **Developer experience** | James thinks in components. The admin `settings.js` (24KB) and `manage-booking.js` (26KB) are dense imperative files that are hard to navigate for anyone who works in React. Cognitive overhead compounds as the project grows. |
| **Testability** | Frontend has zero tests today. With Preact components, business logic (slot generation, validation, date math) can be unit-tested in isolation. UI flows can be tested with Preact Testing Library. |
| **TSX ergonomics** | Template literals for HTML strings provide no autocomplete, no type checking on props, no component boundaries. TSX gives all of this. |

### Costs

| Cost | Detail |
|---|---|
| **Build pipeline** | Going from zero build steps to Vite introduces `npm run build` in CI, a `vite.config.ts`, a second `tsconfig`, and modest `node_modules` growth. One-time setup cost. |
| **Bundle size** | Preact runtime adds ~3KB gzipped to the widget. Current raw-module approach has zero framework overhead. 3KB is acceptable for a booking widget. |
| **Migration effort** | Full widget + admin is a 2–3 day focused rewrite for someone with React experience. Admin is the heavier lift. |
| **Dev workflow change** | Currently `wrangler dev` handles everything. Post-migration: `wrangler dev` + `vite dev` run in parallel (one `npm run dev` script handles both). |

### Why Preact vs Alternatives

| Option | Bundle (gzip) | James's familiarity | Verdict |
|---|---|---|---|
| **Preact** | ~3KB | High (React API compat) | ✅ Best fit |
| React | ~44KB | High | Bundle too large for embeddable widget |
| Solid | ~7KB | Low | Different paradigm, unfamiliar syntax |
| Vue | ~22KB | Unknown | Different paradigm |
| Astro | Varies | Low | Over-engineered for an SPA widget |
| Lit | ~5KB | Low | Web-components focused, not React idioms |

Preact wins clearly. `preact/compat` provides full React API compatibility — hooks, Context, refs all work identically to React. The ergonomics James expects from Next.js are available at a fraction of the bundle cost.

---

## 2. Feasibility

### No fundamental blockers

Every UI pattern in the codebase maps cleanly to Preact components:
- All state is already isolated in module-level or IIFE-scoped objects (`formState`, `state`, `currentDate`) — this maps directly to `useState`/Signals
- All API calls are plain `fetch()` — no DOM coupling, no changes needed
- The Hono backend serves JSON; it doesn't care what renders the HTML
- Preact compiles to self-contained JS bundles — the embed story (iframe with `?tenant=`) is preserved
- Zero Cloudflare/Wrangler incompatibility — Preact output is plain HTML/CSS/JS

### Areas requiring care (not blockers)

**1. `theme.js` must stay a blocking script**
It applies CSS custom properties from URL params to `:root` before first render to prevent FOUC. It cannot be bundled into the Preact app's deferred chunk. It must remain a standalone `<script>` (no `defer`, no `type="module"`) in `<head>`, loaded before the Preact bundle. The Preact app mounts _after_ the theme vars are already applied.

**2. `calendar-core.js` shared dynamic imports**
Admin scripts (`date-picker.js`, `settings.js`) do `import('/js/calendar-core.js')` at runtime. If this module becomes a compiled Preact component, those imports break. The solution is to migrate both the widget and admin together so `calendar-core.js` becomes a shared `CalendarGrid.tsx` component imported by both.

**3. Admin window globals**
`window.AdminAuth`, `window.BookingModal`, `window.DatePicker` are loaded via `<script src>` tags without `type="module"`. Migrating the admin to Preact means these become proper ES module imports — a meaningful refactor but not complex.

**4. `manage-booking.js` state machine (26KB)**
This file has 8 views (`loading`, `error`, `overview`, `edit-details`, `change-datetime`, `cancel-confirm`, `success-edit`, `success-cancel`), a full calendar picker, time slot selection, and form validation. It migrates cleanly to a Preact `signal<ManageView>` + switch on the render, but needs careful testing.

---

## 3. Architecture Decisions

### Two separate Preact apps

The widget and admin must be separate bundles:
- The **widget** is size-sensitive, embedded in third-party sites via iframe. It must be lean.
- The **admin** is an internal tool served only to authenticated staff. Bundle size is irrelevant.

Vite's multi-page app (MPA) config handles this cleanly — one `vite.config.ts` with multiple `input` entrypoints.

### State management

**Widget: Preact Signals (`@preact/signals`)**

The widget has clear reactive dependencies (`selectedDate` → fetch blocked times → update slots). Signals are perfect: fine-grained reactivity, ~2KB, no Context threading needed.

```ts
const selectedDate = signal<CalendarDate | null>(null);
const guests = signal(2);
const blockedTimes = signal<string[]>([]);
const step = signal<BookingStep>(1);
```

**Admin: `useState` + `useReducer`**

The admin has more complex state but nothing that warrants a library. Each page manages its own state; the booking modal uses a simple `useReducer` for its `open/edit/delete/closed` state machine.

### No third-party state library needed (Zustand, Redux, MobX, Jotai)

The scope doesn't justify the dependency.

---

## 4. Exact File & Folder Structure

All new Preact source lives under `src/frontend/`. Existing backend files in `src/` are **unchanged**. The build outputs to `dist/` (Wrangler's new assets directory).

```
reservation-station/
├── src/
│   ├── frontend/                        ← NEW: all Preact source
│   │   │
│   │   ├── booking-widget/              ← Customer-facing booking flow
│   │   │   ├── index.tsx                Vite entry. Reads #booking-widget-root, renders <BookingWidget />
│   │   │   ├── BookingWidget.tsx        Root component. Reads URL params (tenant, theme, mode).
│   │   │   │                            Owns selectedDate. Conditionally renders CalendarView or
│   │   │   │                            BookingFormView. Wraps in TenantContext.Provider.
│   │   │   ├── components/
│   │   │   │   ├── CalendarView.tsx     Props: tenantConfig, selectedDate, onDateSelect.
│   │   │   │   │                        State: currentYear, currentMonth, blockedDates Set,
│   │   │   │   │                        tooltipAnchor. Fetches blocked dates on mount + nav.
│   │   │   │   │                        Uses useBlockedDates hook.
│   │   │   │   ├── CalendarHeader.tsx   Props: month (0-indexed), year, canGoPrev, onPrev, onNext.
│   │   │   │   │                        Renders month/year title + prev/next buttons.
│   │   │   │   ├── BookingFormView.tsx  Props: selectedDate, tenantConfig, onChangeDate.
│   │   │   │   │                        State: step (1|2|'success'), formData, blockedTimes,
│   │   │   │   │                        isLoadingSlots. Uses useBookingForm + useBlockedTimes.
│   │   │   │   ├── SelectedDateBanner.tsx  Props: date (CalendarDate), onChangeDate.
│   │   │   │   │                           Renders formatted date + "Change date" button.
│   │   │   │   ├── StepIndicator.tsx    Props: current (1|2), total (2). "Step X of Y" badge.
│   │   │   │   ├── BookingStep1.tsx     Props: formData, availableSlots, isLoadingSlots, maxGuests,
│   │   │   │   │                        onGuestsChange, onTimeChange, onNext, onChangeDate.
│   │   │   │   │                        Renders guests <select> + TimeSlotPicker + nav buttons.
│   │   │   │   ├── TimeSlotPicker.tsx   Props: slots, selectedTime, onChange, isLoading.
│   │   │   │   │                        <select> when slots exist, else "no availability" <p>.
│   │   │   │   ├── BookingStep2.tsx     Props: formData, onFieldChange, onBack, onSubmit,
│   │   │   │   │                        isSubmitting, error. Uses checkValidity() for submit button.
│   │   │   │   ├── PersonalDetailsForm.tsx  Props: formData, onChange.
│   │   │   │   │                            Controlled inputs: firstName, surname, email (type=email),
│   │   │   │   │                            telephone (type=tel + pattern), dietary (textarea).
│   │   │   │   └── BookingSuccess.tsx   Props: formData, selectedDate, onNewBooking.
│   │   │   │                            Success card + "Make Another Booking" button.
│   │   │   ├── hooks/
│   │   │   │   ├── useTheme.ts          Reads ?theme= and ?mode= from URL. Returns { themeName, mode }.
│   │   │   │   │                        NOTE: DOM application is done by blocking theme.js in <head>.
│   │   │   │   │                        This hook is for components needing the active theme value.
│   │   │   │   ├── useTenant.ts         Takes tenantId: string | null.
│   │   │   │   │                        Calls GET /api/tenants/:id.
│   │   │   │   │                        Returns { tenantConfig, loading, error }.
│   │   │   │   ├── useBlockedDates.ts   Takes tenantId, year, month.
│   │   │   │   │                        Returns { blockedDates: Set<string>, loading }.
│   │   │   │   │                        Re-fetches on year/month change.
│   │   │   │   ├── useBlockedTimes.ts   Takes tenantId, date (CalendarDate | null), guests.
│   │   │   │   │                        Returns { blockedTimes: string[], loading }.
│   │   │   │   │                        Re-fetches on date or guests change.
│   │   │   │   ├── useBookingForm.ts    Owns full form state + lifecycle.
│   │   │   │   │                        Returns state + handlers: setGuests, setTime, setField,
│   │   │   │   │                        nextStep, prevStep, submit, reset.
│   │   │   │   │                        Calls POST /api/reservations internally.
│   │   │   │   └── useTimeSlots.ts      Pure hook (no fetch). Takes tenantConfig, date, blockedTimes.
│   │   │   │                            Returns availableSlots: string[]. Derives from generateSlots +
│   │   │   │                            getSlotsForDate + getEarliestTodaySlot (shared utils).
│   │   │   ├── context/
│   │   │   │   └── TenantContext.ts     createContext<TenantConfig | null>(null).
│   │   │   │                            Exports TenantProvider and useTenantContext hook.
│   │   │   ├── types/
│   │   │   │   ├── booking.ts           CalendarDate, BookingFormData, BookingStep,
│   │   │   │   │                        BookingFormState, BookingRequest (POST body).
│   │   │   │   ├── tenant.ts            TenantConfig, OpeningHoursEntry, ThemeName, ThemeMode.
│   │   │   │   └── availability.ts      BlockedTimesResponse, BlockedDatesResponse.
│   │   │   ├── utils/
│   │   │   │   ├── api.ts               fetchTenant(id), fetchBlockedDates(tenantId, monthStr),
│   │   │   │   │                        fetchBlockedTimes(tenantId, dateStr, guests),
│   │   │   │   │                        createReservation(body: BookingRequest): Promise<void>.
│   │   │   │   │                        All fail-open or throw with typed errors.
│   │   │   │   ├── dates.ts             formatDateForAPI(date: CalendarDate): string,
│   │   │   │   │                        formatDateForDisplay(date): string, isToday(date): boolean,
│   │   │   │   │                        parseYYYYMMDD(str): CalendarDate.
│   │   │   │   └── slots.ts             generateSlots(open, close): string[],
│   │   │   │                            getSlotsForDate(date, tenantConfig): string[],
│   │   │   │                            getEarliestTodaySlot(): string,
│   │   │   │                            getAvailableSlots(date, blockedTimes, tenantConfig): string[].
│   │   │   └── styles/
│   │   │       └── widget.module.css    Scoped widget styles (CSS Modules). Migrated from styles.css.
│   │   │                                References var(--primary) etc. from shared.css global tokens.
│   │   │
│   │   ├── cancel/                      ← Standalone cancel-booking page
│   │   │   ├── index.tsx                Vite entry. Mounts <CancelApp /> to #cancel-root.
│   │   │   ├── CancelApp.tsx            Root. Reads ?id= from URL.
│   │   │   │                            State: view ('loading'|'error'|'review'|'success'),
│   │   │   │                            reservation, errorMessage. Uses useReservation + useCancelBooking.
│   │   │   ├── components/
│   │   │   │   ├── ReservationReview.tsx  Props: reservation, onCancel, isCancelling, cancelError.
│   │   │   │   │                          Renders BookingDetailsList (shared) + CancelButton.
│   │   │   │   ├── CancelButton.tsx     Props: onCancel, isLoading, disabled. Renders .button-danger.
│   │   │   │   └── CancellationSuccess.tsx  Props: reservation. Success MessageCard (shared).
│   │   │   └── hooks/
│   │   │       ├── useReservation.ts    Takes id: string | null. GET /api/reservations/:id on mount.
│   │   │       │                        Returns { reservation, loading, error }.
│   │   │       └── useCancelBooking.ts  Returns { cancel(id), isCancelling, error }.
│   │   │                                Calls DELETE /api/reservations/:id.
│   │   │
│   │   ├── manage-booking/              ← Standalone manage-booking page (edit/reschedule/cancel)
│   │   │   ├── index.tsx                Vite entry. Mounts <ManageBookingApp /> to #manage-root.
│   │   │   ├── ManageBookingApp.tsx     Root. Reads ?id= from URL. Owns full ManageState (8 views).
│   │   │   │                            Uses useManageBooking hook for all data + actions.
│   │   │   ├── components/
│   │   │   │   ├── BookingOverview.tsx  Props: reservation, onEditDetails, onChangeDateTime, onCancel.
│   │   │   │   │                        Renders BookingDetailsList + 3 action buttons.
│   │   │   │   ├── EditDetailsForm.tsx  Props: editData, onFieldChange, onSave, onBack, isSaving, error.
│   │   │   │   │                        Controlled inputs: firstName, surname, email, phone, dietary.
│   │   │   │   ├── ChangeDateTimeView.tsx  Props: tenantConfig, reservation, blockedDates,
│   │   │   │   │                           blockedTimes, selectedDate, selectedTime, onDateSelect,
│   │   │   │   │                           onTimeSelect, onSave, onBack, isSaving, isLoadingSlots, error.
│   │   │   │   │                           Renders CalendarGrid (shared) + TimeSlotPicker (shared).
│   │   │   │   ├── CancelConfirmView.tsx  Props: reservation, onConfirm, onBack, isCancelling, error.
│   │   │   │   └── ManageBookingSuccess.tsx  Props: type ('edit'|'cancel'), reservation. Success card.
│   │   │   ├── hooks/
│   │   │   │   └── useManageBooking.ts  All state + actions. Fetches reservation + tenantConfig on mount.
│   │   │   │                            Exposes: state, setView, saveEdit, saveDateTime, confirmCancel.
│   │   │   │                            Handles PATCH + DELETE calls. Preserves editData from live
│   │   │   │                            form values across failed saves.
│   │   │   └── types/
│   │   │       └── manage.ts            ManageView union type, ManageState interface, EditData interface.
│   │   │
│   │   ├── admin/                       ← Admin dashboard (operator interface)
│   │   │   ├── index.tsx                Vite entry. Mounts <AdminApp /> to #admin-root.
│   │   │   ├── AdminApp.tsx             Root. Reads admin_token from localStorage.
│   │   │   │                            Renders <LoginPage /> or <AuthenticatedLayout />.
│   │   │   │                            Provides AuthContext.
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx        Props: onSuccess.
│   │   │   │   │                        State: email, password, error, isLoading.
│   │   │   │   │                        Calls useAuth().login(). Reads ?expired=1 for session banner.
│   │   │   │   │                        aria-live="assertive" error banner. Status-code-specific messages.
│   │   │   │   ├── Sidebar.tsx          Props: activeRoute, onNavigate.
│   │   │   │   │                        Renders NavLink × 2 + SettingsAccordion.
│   │   │   │   ├── NavLink.tsx          Props: label, isActive, onClick. Single nav button.
│   │   │   │   ├── SettingsAccordion.tsx  Props: activeSubRoute, onNavigate.
│   │   │   │   │                          Manages expanded state. 3 NavLink sub-items.
│   │   │   │   ├── MainHeader.tsx       Props: venueName, onSignOut. Venue name + sign-out button.
│   │   │   │   ├── AlertBanner.tsx      Props: type ('success'|'error'|'info'), message, visible.
│   │   │   │   │                        Auto-dismisses after 3.5s. Uses aria-live.
│   │   │   │   ├── bookings/
│   │   │   │   │   ├── BookingsView.tsx  Props: tenantId.
│   │   │   │   │   │                     Owns currentDate, reservations, isBlocked state.
│   │   │   │   │   │                     Uses useBookings + useBlockState hooks.
│   │   │   │   │   ├── DateNavigator.tsx  Props: currentDate, onPrev, onNext, onDateSelect.
│   │   │   │   │   │                      Renders formatted date (clickable) + Prev/Next buttons.
│   │   │   │   │   │                      Contains DatePickerPopup.
│   │   │   │   │   ├── DatePickerPopup.tsx  Props: isOpen, anchorEl, onSelect, onClose.
│   │   │   │   │   │                        Preact portal. Floating popup with CalendarGrid (shared).
│   │   │   │   │   │                        All dates selectable (including past). Positioned via
│   │   │   │   │   │                        getBoundingClientRect on anchorEl.
│   │   │   │   │   ├── DaySummary.tsx   Props: reservations. Computes + displays total covers.
│   │   │   │   │   ├── DayBlockToggle.tsx  Props: date, isBlocked, onToggle.
│   │   │   │   │   │                       Toggle switch + AlertBanner. Optimistic UI — parent
│   │   │   │   │   │                       updates state; reverts on error.
│   │   │   │   │   ├── BookingTable.tsx  Props: reservations, onEdit, onDelete.
│   │   │   │   │   │                     Desktop <table> with thead + BookingRow × n.
│   │   │   │   │   ├── BookingRow.tsx    Props: reservation, onEdit, onDelete.
│   │   │   │   │   │                     Time / name / guests / dietary / Edit + Delete buttons.
│   │   │   │   │   ├── BookingCards.tsx  Props: reservations, onEdit, onDelete. Mobile view.
│   │   │   │   │   └── BookingCard.tsx   Props: reservation, onEdit, onDelete. Card layout.
│   │   │   │   ├── modals/
│   │   │   │   │   ├── BookingModal.tsx  Props: mode ('edit'|'delete'|null), reservation,
│   │   │   │   │   │                     onClose, onSuccess. Preact portal wrapping native <dialog>.
│   │   │   │   │   │                     Opens/closes via dialog.showModal() / dialog.close().
│   │   │   │   │   │                     Handles focus management.
│   │   │   │   │   ├── EditBookingForm.tsx  Props: reservation, onSave, onClose, isSaving, error.
│   │   │   │   │   │                        All fields: firstName, surname, email, phone, date,
│   │   │   │   │   │                        time, guests, dietary.
│   │   │   │   │   └── DeleteBookingConfirm.tsx  Props: reservation, onDelete, onClose,
│   │   │   │   │                                  isDeleting, error. Confirmation + destructive action.
│   │   │   │   └── settings/
│   │   │   │       ├── SettingsView.tsx  Reads window.location.hash. Hash routing:
│   │   │   │       │                     #general → GeneralSettings, #opening-hours → OpeningHoursSettings,
│   │   │   │       │                     #blocked-dates → BlockedDatesSettings.
│   │   │   │       │                     Normalises invalid hashes via history.replaceState.
│   │   │   │       ├── GeneralSettings.tsx  Loads + saves /api/admin/me.
│   │   │   │       │                        State: formValues, isSaving, error, success.
│   │   │   │       │                        Renders: venue name, max party size, max covers,
│   │   │   │       │                        concurrent guest time window. Includes TimeWindowTooltip.
│   │   │   │       ├── TimeWindowTooltip.tsx  Props: maxCovers, timeWindow. Pure.
│   │   │   │       │                          Tooltip showing calculated values. Updates live on input.
│   │   │   │       ├── OpeningHoursSettings.tsx  Loads + saves /api/admin/opening-hours.
│   │   │   │       │                              State: schedule (7 OpeningHoursEntry rows), isSaving.
│   │   │   │       │                              Renders OpeningHoursTable + OpeningHoursCards
│   │   │   │       │                              (same data source, synced bidirectionally).
│   │   │   │       ├── OpeningHoursTable.tsx   Desktop <table>. OpeningHoursRow × 7.
│   │   │   │       ├── OpeningHoursRow.tsx     Props: entry, onChange(field, value). Single <tr>.
│   │   │   │       │                            Closed checkbox disables time inputs + reduces opacity.
│   │   │   │       ├── OpeningHoursCards.tsx   Mobile card grid. OpeningHoursCard × 7.
│   │   │   │       ├── OpeningHoursCard.tsx    Props: entry, onChange(field, value). Single mobile card.
│   │   │   │       ├── BlockedDatesSettings.tsx  Renders AdminBlockedCalendar with auth token.
│   │   │   │       └── AdminBlockedCalendar.tsx  Props: token.
│   │   │   │                                     Owns: blockedSet (Set<string>), rangeStart,
│   │   │   │                                     viewYear, viewMonth. Loads blocked dates per month.
│   │   │   │                                     Click-to-toggle single day or two-click range
│   │   │   │                                     (same interaction as vanilla JS). Hover range preview.
│   │   │   │                                     Uses CalendarGrid (shared).
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts           Returns { login(email, pw), logout, getToken, getTenant,
│   │   │   │   │                         isAuthenticated }. Reads/writes localStorage (admin_token,
│   │   │   │   │                         admin_tenant). Replaces window.AdminAuth IIFE.
│   │   │   │   ├── useTenantAdmin.ts    Returns { tenant, loading, save(body), isSaving, error }.
│   │   │   │   │                        GET + PATCH /api/admin/me.
│   │   │   │   ├── useBookings.ts       Takes date: string.
│   │   │   │   │                        Returns { reservations, loading, error, reload }.
│   │   │   │   │                        GET /api/admin/reservations?date=.
│   │   │   │   ├── useBlockState.ts     Takes date: string.
│   │   │   │   │                        Returns { isBlocked, loading, toggle }.
│   │   │   │   │                        GET /api/admin/blocked-dates?date= + POST/DELETE on toggle.
│   │   │   │   ├── useOpeningHours.ts   Returns { schedule, loading, save(rows), isSaving, error }.
│   │   │   │   │                        GET + PUT /api/admin/opening-hours.
│   │   │   │   └── useAdminBlockedDates.ts  Takes year, month.
│   │   │   │                               Returns { blockedSet, loading, blockDay(dateStr),
│   │   │   │                               unblockDay(dateStr), blockRange(y, m, d1, d2) }.
│   │   │   │                               Manages API calls + local Set state.
│   │   │   ├── context/
│   │   │   │   └── AuthContext.ts       createContext for { token, tenant }.
│   │   │   │                            Exports AuthProvider and useAuthContext hook.
│   │   │   ├── types/
│   │   │   │   └── admin.ts             AdminTenant (extends TenantConfig), AdminReservation,
│   │   │   │                            BlockedDate, AdminLoginResponse.
│   │   │   └── utils/
│   │   │       └── api.ts               apiFetch(path, options, token): typed wrapper.
│   │   │                                Auto-adds Authorization Bearer header. On 401 → calls logout().
│   │   │                                Replaces the window globals pattern.
│   │   │
│   │   └── shared/                      ← Shared between widget, cancel, manage-booking, admin
│   │       ├── components/
│   │       │   │
│   │       │   ├── Button/              CANONICAL button. Covers every button variant in the codebase.
│   │       │   │   ├── index.tsx        variant: 'primary'|'secondary'|'danger'|'ghost'|
│   │       │   │   │                    'action-edit'|'action-delete'. size: 'sm'|'md'.
│   │       │   │   │                    isLoading?, fullWidth?, disabled?, onClick?, type?.
│   │       │   │   │                    Loading state renders inline CSS spinner via ::after.
│   │       │   │   │                    Source: .button-secondary (widget/manage/cancel),
│   │       │   │   │                    .btn-primary (admin login + modal save), .button-danger /
│   │       │   │   │                    .btn-danger (cancel/admin destructive), .change-date-btn
│   │       │   │   │                    (ghost outline), .btn-edit / .btn-delete (table inline).
│   │       │   │   └── Button.module.css
│   │       │   │
│   │       │   ├── Input/               Controlled text/email/tel/number/date/time input.
│   │       │   │   ├── index.tsx        Props: type, value, onChange, label?, error?, hint?,
│   │       │   │   │                    required?, disabled?, placeholder?, pattern?,
│   │       │   │   │                    autocomplete?, maxLength?.
│   │       │   │   │                    Renders .form-group: label + input + .field-error.
│   │       │   │   │                    :user-invalid CSS hook preserved (field-error shows
│   │       │   │   │                    automatically after interaction without JS).
│   │       │   │   │                    Source: firstName/surname/email/telephone in booking-form.js
│   │       │   │   │                    + manage-booking.js; date/time/number in booking-modal.js;
│   │       │   │   │                    email + password in admin login; time inputs in
│   │       │   │   │                    opening-hours settings.
│   │       │   │   └── Input.module.css
│   │       │   │
│   │       │   ├── Select/              Styled select dropdown.
│   │       │   │   ├── index.tsx        Props: options: { value: string; label: string }[],
│   │       │   │   │                    value, onChange, label?, error?, required?, disabled?.
│   │       │   │   │                    Renders .form-group with native <select>.
│   │       │   │   │                    Source: guest count dropdown (booking-form.js,
│   │       │   │   │                    manage-booking.js, admin modal), time slot select
│   │       │   │   │                    (booking-form.js, manage-booking.js change-datetime view).
│   │       │   │   └── Select.module.css
│   │       │   │
│   │       │   ├── Textarea/            Controlled textarea for multi-line input.
│   │       │   │   ├── index.tsx        Props: value, onChange, label?, placeholder?,
│   │       │   │   │                    rows?, maxLength?, hint?, disabled?.
│   │       │   │   │                    Renders .form-group with resizable textarea.
│   │       │   │   │                    Source: dietary requirements in booking-form.js,
│   │       │   │   │                    manage-booking.js edit form, admin booking modal.
│   │       │   │   └── Textarea.module.css
│   │       │   │
│   │       │   ├── FormField/           Generic label + child + error/hint wrapper.
│   │       │   │   ├── index.tsx        Props: label, htmlFor, error?, hint?, required?, children.
│   │       │   │   │                    Layout shell for custom controls that don't fit
│   │       │   │   │                    Input/Select/Textarea (e.g. TimeSlotPicker, inline calendar).
│   │       │   │   │                    Source: .form-group pattern present in every form across
│   │       │   │   │                    all five HTML files and all booking JS files.
│   │       │   │   └── FormField.module.css
│   │       │   │
│   │       │   ├── ToggleSwitch/        Accessible CSS pill toggle (track + animated knob).
│   │       │   │   ├── index.tsx        Props: checked, onChange, label, id, disabled?.
│   │       │   │   │                    Renders .form-group-check > label + .toggle-switch >
│   │       │   │   │                    input[type=checkbox role=switch]. Focus ring via
│   │       │   │   │                    :has(input:focus-visible). Motion respects prefers-reduced.
│   │       │   │   │                    Source: .form-group-check + .toggle-switch in admin.css.
│   │       │   │   │                    Used by: "Closed" per-day toggle in OpeningHoursRow/Card
│   │       │   │   │                    (×7 rows), "Block this day" toggle in DayBlockToggle.
│   │       │   │   └── ToggleSwitch.module.css
│   │       │   │
│   │       │   ├── Alert/               Compact inline alert banner (not the full MessageCard).
│   │       │   │   ├── index.tsx        Props: type: 'error'|'info'|'success', message,
│   │       │   │   │                    visible?: boolean, ariaLive?: 'polite'|'assertive'.
│   │       │   │   │                    Renders .alert .alert-{type} with aria-hidden toggling.
│   │       │   │   │                    No icon or bold title — compact single-line or short-para.
│   │       │   │   │                    Source: .alert-error (admin login error banner + modal
│   │       │   │   │                    inline error), .alert-info (session-expired banner in
│   │       │   │   │                    admin/index.html), .alert-success (day-block feedback
│   │       │   │   │                    in dashboard.js). Distinct from MessageCard: smaller,
│   │       │   │   │                    no icon, no heading structure.
│   │       │   │   └── Alert.module.css
│   │       │   │
│   │       │   ├── Modal/               <dialog>-based accessible modal with backdrop blur.
│   │       │   │   ├── index.tsx        Props: isOpen, onClose, title, children (body),
│   │       │   │   │                    footer?, ariaLabel?. Preact portal. Calls
│   │       │   │   │                    dialog.showModal() / dialog.close(). Backdrop click closes.
│   │       │   │   │                    Focus trap: focuses first interactive element on open;
│   │       │   │   │                    returns focus to trigger element on close.
│   │       │   │   │                    Source: .booking-modal dialog + .modal-inner/header/
│   │       │   │   │                    close/form/actions in admin.css; BookingModal IIFE in
│   │       │   │   │                    booking-modal.js (ensureDialog + openModal + closeModal).
│   │       │   │   │                    Used by: EditBookingForm, DeleteBookingConfirm (admin).
│   │       │   │   ├── Modal.module.css
│   │       │   │   └── Modal.types.ts   ModalProps interface.
│   │       │   │
│   │       │   ├── Badge/               Small pill/chip for inline metadata display.
│   │       │   │   ├── index.tsx        Props: children, variant?: 'default'|'primary'|'today'.
│   │       │   │   │                    border-radius: full. Compact padding.
│   │       │   │   │                    Source: .card-guests (rounded guest-count pill in admin
│   │       │   │   │                    booking card), .today-label (dashboard date "today" badge).
│   │       │   │   └── Badge.module.css
│   │       │   │
│   │       │   ├── SelectedDateInfo/    Selected-date display panel used in booking flows.
│   │       │   │   ├── index.tsx        Props: date: CalendarDate, onChangeDate?: () => void.
│   │       │   │   │                    Renders .selected-date-info with .date-label + .date-value
│   │       │   │   │                    + optional "Change date" ghost Button.
│   │       │   │   │                    Source: .selected-date-info + .date-label + .date-value
│   │       │   │   │                    in shared.css + styles.css; renderStep1 in booking-form.js;
│   │       │   │   │                    renderTimeSlots in manage-booking.js.
│   │       │   │   │                    Used by: BookingStep1 (widget), ChangeDateTimeView (manage).
│   │       │   │   └── SelectedDateInfo.module.css
│   │       │   │
│   │       │   ├── CalendarGrid/        CANONICAL shared calendar grid. The renderCalendarGrid
│   │       │   │   ├── index.tsx        function from calendar-core.js, rewritten as a Preact component.
│   │       │   │   │                    Props: CalendarGridProps { year, month, selectedDate?,
│   │       │   │   │                    isBlocked?(y,m,d), isDisabled?(y,m,d), onSelect?,
│   │       │   │   │                    onBlockedSelect?, cellClass?, headerClass? }.
│   │       │   │   │                    Used by: booking-widget CalendarView, admin DatePickerPopup,
│   │       │   │   │                    admin AdminBlockedCalendar, manage-booking ChangeDateTimeView.
│   │       │   │   │                    Preserves: today dot, past greying, blocked hatching,
│   │       │   │   │                    selected ring, keyboard nav (Enter/Space), ARIA roles.
│   │       │   │   └── CalendarGrid.module.css
│   │       │   │
│   │       │   ├── DayCell/             Pure single day cell rendered by CalendarGrid.
│   │       │   │   └── index.tsx        Props: day, isToday, isPast, isBlocked, isSelected,
│   │       │   │                        isEmpty, onSelect?, onBlockedSelect?.
│   │       │   │                        ARIA: role="button"|"gridcell", aria-pressed, aria-disabled.
│   │       │   │
│   │       │   ├── BlockedTooltip/      Absolutely-positioned tooltip over blocked calendar cells.
│   │       │   │   └── index.tsx        Preact portal. Props: anchorRect: DOMRect,
│   │       │   │                        containerRef: RefObject<Element>, onDismiss: () => void.
│   │       │   │                        Auto-dismiss after 3 s + outside-click listener.
│   │       │   │                        Source: .calendar-blocked-tooltip in shared.css +
│   │       │   │                        styles.css; showBlockedTooltip() in calendar.js +
│   │       │   │                        manage-booking.js.
│   │       │   │
│   │       │   ├── Spinner/             CSS loading spinner (replaces LoadingSpinner.tsx).
│   │       │   │   ├── index.tsx        Props: label?: string, size?: 'sm'|'md'.
│   │       │   │   │                    Renders .spinner + visually-hidden <span> for screen readers.
│   │       │   │   │                    Also exports <LoadingIndicator> (flex row: spinner + visible
│   │       │   │   │                    inline text) matching the .loading-indicator layout used in
│   │       │   │   │                    cancel.js + manage-booking.js renderLoading().
│   │       │   │   └── Spinner.module.css
│   │       │   │
│   │       │   ├── MessageCard/         Full-width status card with SVG icon + heading + body.
│   │       │   │   ├── index.tsx        Props: type: 'success'|'error', title, children.
│   │       │   │   │                    Renders .message .{type}-message > .message-header
│   │       │   │   │                    (SVG icon + h*) + body paragraph.
│   │       │   │   │                    The check-circle and info-circle SVGs are inlined —
│   │       │   │   │                    same icons used in all three JS files.
│   │       │   │   │                    Source: success/error .message divs in booking-form.js
│   │       │   │   │                    (booking confirmed, error), cancel.js (cancelled, error),
│   │       │   │   │                    manage-booking.js (edit success, cancel success, error).
│   │       │   │   └── MessageCard.module.css
│   │       │   │
│   │       │   ├── BookingDetailsList/  Structured key-value list of reservation fields.
│   │       │   │   └── index.tsx        Props: reservation: Reservation.
│   │       │   │                        Renders .details-list > .detail-row × n with
│   │       │   │                        .detail-term / .detail-value for name, date, time,
│   │       │   │                        party size, dietary (conditionally).
│   │       │   │                        Source: detailsHtml() + .details-list in cancel.js
│   │       │   │                        + manage-booking.js. Pattern is identical in both.
│   │       │   │                        Used by: cancel ReservationReview, manage-booking
│   │       │   │                        overview + cancel-confirm, admin delete modal.
│   │       │   │
│   │       │   └── StandaloneLayout/    Full-page centred card shell for public standalone pages.
│   │       │       ├── index.tsx        Props: children.
│   │       │       │                    Renders .standalone-page > .standalone-container >
│   │       │       │                    .standalone-card (max-width 640px).
│   │       │       │                    Source: standalone-* classes in shared.css; used by
│   │       │       │                    cancel/index.html + booking/manage/index.html.
│   │       │       └── StandaloneLayout.module.css
│   │       │
│   │       ├── types/
│   │       │   ├── index.ts             Re-exports all shared types for convenient single import.
│   │       │   ├── reservation.ts       Reservation { id, tenant_id, first_name, surname, email,
│   │       │   │                         telephone, reservation_date, reservation_time, guests,
│   │       │   │                         dietary_requirements? }
│   │       │   ├── tenant.ts            TenantConfig, OpeningHoursEntry, ThemeName, ThemeMode.
│   │       │   └── calendar.ts          CalendarDate { year, month, day }.
│   │       │                            MONTHS: string[], DAY_NAMES: string[].
│   │       └── utils/
│   │           ├── dates.ts             formatDateForAPI, formatDateForDisplay, isToday,
│   │           │                        parseYYYYMMDD, formatDateUTC (cancel/manage pattern:
│   │           │                        T12:00:00Z + UTC timezone to prevent drift).
│   │           ├── slots.ts             generateSlots, getSlotsForDate, getEarliestTodaySlot,
│   │           │                        getAvailableSlots. All pure functions. tenantConfig is
│   │           │                        an explicit param (not a module singleton).
│   │           └── formatting.ts        getFullName(r: Reservation): string,
│   │                                    getGuestsLabel(n: number): string. Pure display helpers.
│   │
│   ├── app.ts                           ← unchanged (Hono app)
│   ├── index.ts                         ← unchanged (Worker entry)
│   ├── db/                              ← unchanged (D1 schema + queries)
│   ├── middleware/                      ← unchanged (auth middleware)
│   ├── routes/                          ← unchanged (all API routes)
│   ├── types/                           ← unchanged
│   └── utils/                           ← unchanged (auth.ts, slots.ts)
│
├── public/                              ← Static files NOT generated by Vite
│   ├── fonts/                           ← unchanged
│   ├── shared.css                       ← unchanged (global CSS tokens + utility classes)
│   └── js/
│       └── theme.js                     ← MUST STAY as blocking <script> in <head>.
│                                         Applies CSS custom properties from URL params before
│                                         first paint. Do NOT bundle into Preact app.
│
├── dist/                                ← Vite build output (gitignored)
│   ├── booking-widget.js                Compiled widget bundle
│   ├── cancel.js                        Compiled cancel bundle
│   ├── manage-booking.js                Compiled manage-booking bundle
│   ├── admin.js                         Compiled admin bundle
│   └── assets/                          Hashed CSS + asset chunks
│
├── vite.config.ts                       ← NEW
├── tsconfig.frontend.json               ← NEW (extends tsconfig.json, adds DOM, JSX for Preact)
├── tsconfig.json                        ← UPDATED (keep Worker config, add shared/ to include)
├── wrangler.jsonc                       ← UPDATED (assets.directory → ./dist)
└── package.json                         ← UPDATED (new scripts + deps)
```

---

## 4a. Shared Component Library

> **Derived from actual codebase scan** of `public/js/`, `public/css/`, `public/*.html`, and `public/admin/`. Every component below maps to a real, recurring pattern found in the existing vanilla JS files. Nothing is invented.

### Component inventory

| Component | Folder | CSS Strategy | Used In |
|---|---|---|---
| `Button` | `shared/components/Button/` | CSS Module | Widget, cancel, manage-booking, admin (all surfaces) |
| `Input` | `shared/components/Input/` | CSS Module | Widget (booking form), manage-booking (edit), admin (login, modal) |
| `Select` | `shared/components/Select/` | CSS Module | Widget (guests, time), manage-booking (edit guests), admin modal |
| `Textarea` | `shared/components/Textarea/` | CSS Module | Widget (dietary), manage-booking (dietary), admin modal |
| `FormField` | `shared/components/FormField/` | CSS Module | Any surface with a custom control needing label+error layout |
| `ToggleSwitch` | `shared/components/ToggleSwitch/` | CSS Module | Admin (opening hours closed toggle ×7, dashboard day-block toggle) |
| `Alert` | `shared/components/Alert/` | CSS Module | Admin (login banners, modal errors, day-block feedback) |
| `Modal` | `shared/components/Modal/` | CSS Module | Admin (edit booking, delete booking confirmation) |
| `Badge` | `shared/components/Badge/` | CSS Module | Admin (guest-count pill in booking card, "today" date label) |
| `SelectedDateInfo` | `shared/components/SelectedDateInfo/` | CSS Module | Widget (step 1), manage-booking (change datetime) |
| `CalendarGrid` | `shared/components/CalendarGrid/` | CSS Module | Widget, manage-booking, admin (date picker popup, blocked-dates settings) |
| `DayCell` | `shared/components/DayCell/` | — (CalendarGrid styles) | Rendered by CalendarGrid only |
| `BlockedTooltip` | `shared/components/BlockedTooltip/` | — (inline portal) | Widget calendar, manage-booking change-datetime |
| `Spinner` | `shared/components/Spinner/` | CSS Module | Cancel (loading), manage-booking (loading), any async operation |
| `MessageCard` | `shared/components/MessageCard/` | CSS Module | Widget (booking confirmed, error), cancel (cancelled, error), manage-booking (edit/cancel success, error) |
| `BookingDetailsList` | `shared/components/BookingDetailsList/` | — (shared.css tokens) | Cancel, manage-booking overview + cancel-confirm, admin delete modal |
| `StandaloneLayout` | `shared/components/StandaloneLayout/` | CSS Module | Cancel page, manage-booking page |

---

### TypeScript props interfaces

```typescript
// ─── Button ─────────────────────────────────────────────────────────────────
type ButtonVariant =
  | 'primary'      // .btn-primary (admin): solid primary colour, loading state
  | 'secondary'    // .button-secondary (widget/manage/cancel): outline border
  | 'danger'       // .button-danger / .btn-danger: solid error-dark
  | 'ghost'        // .change-date-btn: transparent with primary border
  | 'action-edit'  // .btn-action.btn-edit: small inline edit button (table/card)
  | 'action-delete'; // .btn-action.btn-delete: small inline delete button

interface ButtonProps {
  variant?: ButtonVariant;          // default: 'secondary'
  size?: 'sm' | 'md';               // default: 'md'
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  isLoading?: boolean;              // shows spinner, disables pointer events
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  children: ComponentChildren;
}

// ─── Input ───────────────────────────────────────────────────────────────────
interface InputProps {
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'time' | 'password';
  id: string;
  name: string;
  value: string | number;
  onChange: (value: string) => void;
  label?: string;
  error?: string;                   // shown below input, replaces .field-error
  hint?: string;                    // shown below label, above input
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  pattern?: string;
  autocomplete?: string;
  maxLength?: number;
  min?: number;                     // for type="number"
  ariaInvalid?: boolean;            // admin login: set on both inputs on auth error
}

// ─── Select ──────────────────────────────────────────────────────────────────
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id: string;
  name: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

// ─── Textarea ────────────────────────────────────────────────────────────────
interface TextareaProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;                    // default: 3
  maxLength?: number;
  hint?: string;
  disabled?: boolean;
}

// ─── FormField ───────────────────────────────────────────────────────────────
interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ComponentChildren;      // any input/select/custom control
}

// ─── ToggleSwitch ────────────────────────────────────────────────────────────
interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

// ─── Alert ───────────────────────────────────────────────────────────────────
interface AlertProps {
  type: 'error' | 'info' | 'success';
  message: string;
  visible?: boolean;                // default: true; false → aria-hidden="true", display:none
  ariaLive?: 'polite' | 'assertive'; // default: 'polite'. Use 'assertive' for auth errors.
}

// ─── Modal ───────────────────────────────────────────────────────────────────
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ComponentChildren;      // modal body content
  footer?: ComponentChildren;       // optional slot below body (alternative to putting actions in body)
  ariaLabel?: string;               // overrides title for aria-label if needed
}

// ─── Badge ───────────────────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'primary' | 'today';

interface BadgeProps {
  children: ComponentChildren;
  variant?: BadgeVariant;           // default: 'default'
}

// ─── SelectedDateInfo ────────────────────────────────────────────────────────
interface SelectedDateInfoProps {
  date: CalendarDate;
  onChangeDate?: () => void;        // renders "Change date" ghost button when provided
}

// ─── CalendarGrid (unchanged from original spec) ─────────────────────────────
interface CalendarGridProps {
  year: number;
  month: number;                    // 0-indexed
  selectedDate?: CalendarDate | null;
  isBlocked?: (year: number, month: number, day: number) => boolean;
  isDisabled?: (year: number, month: number, day: number) => boolean;
  onSelect?: (year: number, month: number, day: number) => void;
  onBlockedSelect?: (year: number, month: number, day: number, cell: Element) => void;
  cellClass?: string;               // default: 'calendar-day'
  headerClass?: string;             // default: 'day-name'
}

// ─── DayCell ─────────────────────────────────────────────────────────────────
interface DayCellProps {
  day: number;
  isToday: boolean;
  isPast: boolean;
  isBlocked: boolean;
  isSelected: boolean;
  isEmpty: boolean;
  dateLabel?: string;               // full human-readable date for aria-label
  onSelect?: () => void;
  onBlockedSelect?: (cell: Element) => void;
}

// ─── BlockedTooltip ──────────────────────────────────────────────────────────
interface BlockedTooltipProps {
  anchorRect: DOMRect;
  containerRef: RefObject<Element>;
  onDismiss: () => void;
  message?: string;                 // default: 'Bookings currently unavailable for this date'
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
interface SpinnerProps {
  label?: string;                   // sr-only text; default: 'Loading'
  size?: 'sm' | 'md';              // sm=18px, md=28px (--size-icon-sm/md tokens)
}

// LoadingIndicator = Spinner + visible inline text (for renderLoading() pattern)
interface LoadingIndicatorProps {
  message?: string;                 // default: 'Loading your booking details…'
}

// ─── MessageCard ─────────────────────────────────────────────────────────────
interface MessageCardProps {
  type: 'success' | 'error';
  title: string;
  children: ComponentChildren;      // body paragraph(s)
}

// ─── BookingDetailsList ───────────────────────────────────────────────────────
interface BookingDetailsListProps {
  reservation: Reservation;
}

// ─── StandaloneLayout ─────────────────────────────────────────────────────────
interface StandaloneLayoutProps {
  children: ComponentChildren;
}
```

### CSS strategy notes

| Component | CSS approach | Rationale |
|---|---|---|
| `Button` | CSS Module | Class names must be scoped — widget is embedded, can't leak `.btn-primary` into host page |
| `Input`, `Select`, `Textarea`, `FormField` | CSS Module | Same — form field classes must not pollute host page on widget |
| `ToggleSwitch` | CSS Module (with `:has()`) | Toggle uses `input:checked` inside `.toggle-switch` via `:has()` — scoped selector still works in CSS Modules |
| `Alert` | CSS Module | Admin-only but consistent with pattern |
| `Modal` | CSS Module | `<dialog>` backdrop uses `::backdrop` pseudo — works fine with CSS Modules on `.booking-modal` |
| `Badge` | CSS Module | Small component, isolated styles |
| `SelectedDateInfo` | CSS Module | Used in widget (embedded) — must be scoped |
| `CalendarGrid`, `DayCell` | CSS Module | Calendar is the core widget component — scoped is essential |
| `Spinner` | CSS Module | Needs scoped `@keyframes spin` (name collision risk without module) |
| `MessageCard` | CSS Module | Success/error cards used in embedded widget |
| `BookingDetailsList` | Shared.css tokens | Pure layout, no custom class names — uses `.details-list` / `.detail-row` from `shared.css`. No module needed; migrate styles into `StandaloneLayout.module.css` if isolation is desired |
| `StandaloneLayout` | CSS Module | Page-level layout for public standalone pages |
| `BlockedTooltip` | Inline styles for positioning + CSS Module for chrome | Tooltip is positioned dynamically via `anchorRect` — `top/left` must be inline. Visual styles (border, bg, shadow) go in module |

---

## 5. TypeScript Types

### Shared types (`src/frontend/shared/types/`)

```typescript
// calendar.ts
interface CalendarDate {
  year: number;
  month: number;   // 0-indexed: Jan=0, Dec=11
  day: number;
}
const MONTHS: string[];    // ['January', ..., 'December']
const DAY_NAMES: string[]; // ['Mon', 'Tue', ..., 'Sun']

// tenant.ts
interface OpeningHoursEntry {
  day_of_week: number;       // 0=Sunday, 1=Monday, ... 6=Saturday
  is_closed: boolean;
  open_time: string | null;  // 'HH:MM'
  close_time: string | null; // 'HH:MM'
}
interface TenantConfig {
  id: string;
  name: string;
  max_guests: number;
  max_covers: number;
  concurrent_guests_time_limit: number;
  opening_hours: OpeningHoursEntry[] | null;
}
type ThemeName = 'default' | 'caffeine' | 'clean-slate' | 'kodama-grove' | 'mocha-mousse' | 'sage-garden';
type ThemeMode = 'light' | 'dark';

// reservation.ts
interface Reservation {
  id: string;
  tenant_id: string;
  first_name: string;
  surname: string;
  email: string;
  telephone: string;
  reservation_date: string;  // 'YYYY-MM-DD'
  reservation_time: string;  // 'HH:MM'
  guests: number;
  dietary_requirements?: string;
  created_at?: string;
}
```

### Booking widget types (`src/frontend/booking-widget/types/`)

```typescript
// booking.ts
interface BookingFormData {
  guests: number;
  time: string;
  firstName: string;
  surname: string;
  email: string;
  telephone: string;
  dietary: string;
}
type BookingStep = 1 | 2 | 'success';
interface BookingRequest {
  tenant_id: string;
  first_name: string;
  surname: string;
  telephone: string;
  email: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  dietary_requirements?: string;
}

// availability.ts
interface BlockedTimesResponse {
  blocked_times: string[];
  time_limit_minutes: number;
}
interface BlockedDatesResponse {
  blocked_dates: string[];
}
```

### Manage booking types (`src/frontend/manage-booking/types/`)

```typescript
// manage.ts
type ManageView =
  | 'loading' | 'error' | 'overview'
  | 'edit-details' | 'change-datetime'
  | 'cancel-confirm' | 'success-edit' | 'success-cancel';

interface EditData {
  first_name: string;
  surname: string;
  email: string;
  telephone: string;
  dietary_requirements: string;
}
interface ManageState {
  view: ManageView;
  reservation: Reservation | null;
  tenantConfig: TenantConfig | null;
  editData: EditData | null;
  selectedDate: CalendarDate | null;
  selectedTime: string;
  blockedDates: Set<string>;
  blockedTimes: string[];
  errorMessage: string;
}
```

### Admin types (`src/frontend/admin/types/`)

```typescript
// admin.ts
interface AdminTenant extends TenantConfig {
  // Inherits all TenantConfig fields visible to admin
}
interface BlockedDate {
  id: string;
  tenant_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
}
interface AdminLoginResponse {
  token: string;
  tenant: AdminTenant;
}
```

---

## 6. Build Setup Changes

### New: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  root: 'src/frontend',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'booking-widget': path.resolve(__dirname, 'src/frontend/booking-widget/index.tsx'),
        'cancel':         path.resolve(__dirname, 'src/frontend/cancel/index.tsx'),
        'manage-booking': path.resolve(__dirname, 'src/frontend/manage-booking/index.tsx'),
        'admin':          path.resolve(__dirname, 'src/frontend/admin/index.tsx'),
      },
    },
  },
  css: {
    modules: { localsConvention: 'camelCase' },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/frontend/shared'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',  // Proxy to wrangler dev
    },
  },
});
```

### New: `tsconfig.frontend.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "noEmit": true,
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  },
  "include": ["src/frontend/**/*.ts", "src/frontend/**/*.tsx"]
}
```

### Updated: `wrangler.jsonc`

Two changes only:

```jsonc
"assets": {
  "directory": "./dist",                           // was: "./public"
  "not_found_handling": "single-page-application"  // new: SPA fallback routing
}
```

Everything else (D1 binding, compatibility flags, observability) is unchanged.

### Updated: `package.json` scripts + dependencies

```json
{
  "scripts": {
    "dev:api":      "wrangler dev",
    "dev:frontend": "vite",
    "dev":          "concurrently \"npm run dev:api\" \"npm run dev:frontend\"",
    "build":        "vite build",
    "deploy":       "npm run build && wrangler deploy",
    "test":         "vitest",
    "cf-typegen":   "wrangler types"
  },
  "devDependencies": {
    "vite": "^5.x",
    "@preact/preset-vite": "^2.x",
    "@preact/signals": "^1.x",
    "concurrently": "^9.x"
  },
  "dependencies": {
    "preact": "^10.x"
  }
}
```

---

## 7. CSS Strategy

| Area | Strategy | Reason |
|---|---|---|
| Booking widget | CSS Modules (`.module.css`) | Embeddable — scoped class names prevent conflicts with host page CSS |
| Cancel page | CSS Modules | Same concern |
| Manage booking | CSS Modules | Same concern |
| Admin dashboard | Plain CSS or CSS Modules | Standalone admin app, no host-page conflict risk. Existing `admin.css` can be imported globally. |
| `shared.css` (design tokens) | **Global CSS** — unchanged | CSS custom properties (`--primary`, `--space-*`, etc.) must remain as global `:root` variables. They cascade through the entire component tree and cannot be scoped to a module. Imported once at each entry's root. |

CSS Modules class names reference `var(--primary)` etc. normally — CSS Modules scopes class names, not CSS variable resolution. Themed vars work seamlessly.

**No Tailwind.** The existing CSS is hand-crafted with custom design tokens. Introducing Tailwind would require a complete visual rewrite. CSS Modules migrates the existing styles with minimal risk.

---

## 8. API Surface (Backend — No Changes)

All 19 API endpoints return pure JSON. Zero endpoints serve HTML. The backend needs no changes.

| Endpoint set | Used by |
|---|---|
| `GET /api/tenants/:id` | Widget (init), Manage Booking (init) |
| `GET /api/reservations/blocked-dates` | Widget calendar nav, Manage Booking calendar nav |
| `GET /api/reservations/blocked-times` | Widget step 1, Manage Booking change datetime |
| `POST /api/reservations/` | Widget booking submission |
| `GET /api/reservations/:id` | Cancel page, Manage Booking |
| `DELETE /api/reservations/:id` | Cancel page, Manage Booking |
| `PATCH /api/reservations/:id` | Manage Booking edit |
| `POST /api/auth/login` | Admin login |
| `GET/PATCH /api/admin/me` | Admin general settings |
| `GET/PATCH/DELETE /api/admin/reservations` | Admin dashboard |
| `GET/POST/DELETE /api/admin/blocked-dates` | Admin blocked dates settings |
| `GET/PUT /api/admin/opening-hours` | Admin opening hours settings |

Auth mechanism (Bearer JWT from localStorage) is framework-agnostic — no backend change needed.

---

## 9. Migration Strategy

### Phased approach (incremental, not big-bang)

**Revised for the shared component library.** Since Twinkie has defined 17 shared components that are used across all 4 surfaces, the original 4-phase plan has a sequencing gap: Phase 3 (widget) depended on `Button`, `FormField`, `Spinner`, `MessageCard`, `CalendarGrid`, and others that didn't have a dedicated build phase. This rewrite fixes that. The shared component library is now a discrete phase that all surface phases depend on.

**Phase order:**

| Phase | What | Key deliverable |
|---|---|---|
| 1 | Infrastructure | Vite + wrangler pipeline proven end-to-end |
| 2 | Shared utilities | Types + pure TS utils extracted, no Preact |
| 3 | Shared component library | All 17 components built + smoke-tested in isolation |
| 4 | Cancel surface | First Preact surface deployed (warmup) |
| 5 | Booking widget | Core product migrated, embed path confirmed |
| 6 | Manage-booking | 8-view state machine migrated |
| 7 | Admin | All `window.*` globals removed, `calendar-core.js` deleted |

---

#### Phase 1: Infrastructure (gate everything on this)

**Goal:** Get Vite building and deploying alongside the unchanged vanilla JS. Prove the end-to-end pipeline before writing any Preact.

**Files to touch:**

- [x] Install `vite`, `@preact/preset-vite`, `preact`, `@preact/signals`, `vitest`, `@preact/testing-library`
- [x] `vite.config.ts` — 4 entry points: `booking-widget`, `cancel`, `manage-booking`, `admin`
- [x] `tsconfig.frontend.json` — separate from root Worker tsconfig; `"jsx": "react-jsx"`, `"jsxImportSource": "preact"`
- [x] `wrangler.jsonc` — update assets directory to point at `dist/`
- [x] `package.json` — `dev` (concurrently runs `wrangler dev` + `vite dev`), `build`, `test:frontend` scripts
- [x] `.gitignore` — add `dist/`

**Dependencies:** None. Vanilla JS stays fully working throughout this phase.

**Complexity:** Low. One-time setup.

**First PR scope: infrastructure only.** Do not write any Preact until a real API call flows through the Vite proxy and the built output deploys successfully.

> ⚠️ **Risk:** `vite.config.ts` proxy must route `/api/*` to `http://localhost:8787`. Verify with a real GET (e.g., `/api/config?tenant=demo`) through the proxy before declaring this phase done.

---

#### Phase 2: Shared utilities (zero Preact, pure TypeScript)

**Goal:** Establish the shared type layer and utility functions. No components yet — only `.ts` files. Everything in Phases 3–7 imports from here.

**Files to build:**

*Types — `src/frontend/shared/types/`:*
- [x] `calendar.ts` — `CalendarDate`, `MONTHS`, `DAY_NAMES`
- [x] `tenant.ts` — `TenantConfig`, `OpeningHoursEntry`, `ThemeName`, `ThemeMode`
- [x] `reservation.ts` — `Reservation`
- [x] `index.ts` — re-export barrel

*Utils — `src/frontend/shared/utils/`:*
- [x] `slots.ts` — single canonical `generateSlots` / `getSlotsForDate`; replaces 3 vanilla copies
- [x] `dates.ts` — `formatDate*`, `isToday`, `parseYYYYMMDD`
- [x] `formatting.ts` — string helpers; note `escapeHtml` becomes unnecessary once JSX is in use, include as shim until vanilla files are deleted
- [x] `index.ts` — re-export barrel

**Dependencies:** Phase 1 complete (tsconfig + Vite config in place so imports resolve).

**Complexity:** Low. Mechanical extraction + type annotations. Write Vitest unit tests for `slots.ts` before moving on.

> ⚠️ **Risk:** `slots.ts` has three divergent copies in the codebase (widget, manage-booking, admin). Read all three before writing the canonical version — edge cases around `time_limit_minutes` may differ. Unit-test the canonical implementation against known inputs before declaring done.

---

#### Phase 3: Shared component library — 17 components

**Goal:** Build all 17 shared components in isolation before any surface work. Every surface phase (4–7) has a hard dependency on this phase. Build order goes primitives → feedback → layout → domain → admin-toggle.

---

**Layer A — Form primitives** *(no Preact dependencies other than JSX itself)*

- [x] `Button/Button.tsx` + `Button.module.css` + `index.ts`
  - 6 variants: `primary`, `secondary`, `danger`, `ghost`, `action-edit`, `action-delete`
  - `isLoading` shows inline `Spinner`, disables pointer events; `fullWidth` and `size` props
- [x] `Input/Input.tsx` + `Input.module.css` + `index.ts`
  - 8 `type` values; `error` + `hint` display below field; `ariaInvalid` for admin login error state
- [x] `Select/Select.tsx` + `Select.module.css` + `index.ts`
  - Typed `SelectOption[]` list; `error` display
- [x] `Textarea/Textarea.tsx` + `Textarea.module.css` + `index.ts`
  - `rows` default 3; `maxLength`; `hint`
- [x] `FormField/FormField.tsx` + `FormField.module.css` + `index.ts`
  - `label` + `error` wrapper; `children` accepts any control; `htmlFor` links label

**Layer B — Feedback & status**

- [x] `Spinner/Spinner.tsx` + `Spinner.module.css` + `index.ts`
  - `sm` (18px) / `md` (28px) sizes; `@keyframes spin` must be scoped to module to avoid global name collision
- [x] `Alert/Alert.tsx` + `Alert.module.css` + `index.ts`
  - `error` / `info` / `success` variants; `visible=false` → `aria-hidden="true"` + `display:none`; `ariaLive` prop (`assertive` for auth errors)
- [x] `MessageCard/MessageCard.tsx` + `MessageCard.module.css` + `index.ts`
  - `success` / `error` card; used in every surface for booking confirmation and error states

**Layer C — Layout & overlay**

- [x] `Modal/Modal.tsx` + `Modal.module.css` + `index.ts`
  - `<dialog>`-based Preact portal; `::backdrop` pseudo-element works with CSS Modules on the root `.booking-modal` class; focus trap on open; `Escape` key calls `onClose`; `footer` slot for action buttons
- [x] `StandaloneLayout/StandaloneLayout.tsx` + `StandaloneLayout.module.css` + `index.ts`
  - Page-level layout wrapper for cancel and manage-booking standalone pages
- [x] `BookingDetailsList/BookingDetailsList.tsx` + `index.ts`
  - Uses `shared.css` `.details-list` / `.detail-row` tokens — **no CSS Module needed**; document this explicitly so future contributors don't add one unnecessarily

**Layer D — Domain & calendar**

- [x] `Badge/Badge.tsx` + `Badge.module.css` + `index.ts`
  - `default` / `primary` / `today` variants; used for guest-count pills and "today" date labels in admin
- [x] `SelectedDateInfo/SelectedDateInfo.tsx` + `SelectedDateInfo.module.css` + `index.ts`
  - Displays selected `CalendarDate`; renders "Change date" ghost button only when `onChangeDate` prop is provided
- [x] `DayCell/DayCell.tsx` + `index.ts`
  - Internal to `CalendarGrid` — styles live in `CalendarGrid.module.css`, not a separate module
- [x] `BlockedTooltip/BlockedTooltip.tsx` + `BlockedTooltip.module.css` + `index.ts`
  - `top` / `left` positioning via inline styles from `anchorRect`; visual chrome (border, bg, shadow) in CSS Module; renders as a portal above the calendar
- [x] `CalendarGrid/CalendarGrid.tsx` + `CalendarGrid.module.css` + `index.ts`
  - The pivotal shared component; renders month grid using `DayCell`; drives widget step 1, manage-booking change-datetime, and admin date pickers + blocked-dates settings

**Layer E — Admin toggle** *(higher risk; admin-only use)*

- [x] `ToggleSwitch/ToggleSwitch.tsx` + `ToggleSwitch.module.css` + `index.ts`
  - Fully controlled component: `checked` prop in, `onChange` out; no internal state
  - Uses `data-checked` attribute strategy (not `:has(input:checked)`) — more reliable across CSS Modules scoping

**Shared barrel:**
- [x] `src/frontend/shared/components/index.ts` — re-exports all components

**Per-component file checklist:** `ComponentName.tsx`, `ComponentName.module.css` (where applicable), `index.ts`, `ComponentName.test.tsx`

**Dependencies:** Phase 2 complete (`CalendarDate` type available for `CalendarGrid`, `DayCell`, `SelectedDateInfo`; `Reservation` for `BookingDetailsList`).

**Complexity:** Medium. 17 components × ~3–4 files = ~55 files total, but most are small and follow the same pattern. `CalendarGrid` and `Modal` are the highest-complexity items.

> ⚠️ **ToggleSwitch (higher risk than it looks):** Used in 8 places — 7 `is_closed` toggles in opening hours settings, 1 day-block toggle on the dashboard. The vanilla implementation relies on CSS `:checked` state on a real `<input type="checkbox">`. The Preact version must be fully controlled. Additionally, test the CSS Module `:has(input:checked)` selector in a real browser before declaring done — if scoping causes issues, fall back to a `data-checked` attribute on the wrapper div. **Do not proceed to Phase 7 with an untested `ToggleSwitch`.**

> ⚠️ **CalendarGrid — do not delete `calendar-core.js` yet:** Building `CalendarGrid.tsx` in this phase means it exists and is tested. The dynamic-import swap (`import('/js/calendar-core.js')` in admin scripts) happens in Phase 7. `calendar-core.js` must remain in `public/js/` until Phase 7 is deployed.

> ⚠️ **CSS tokens bootstrap:** Before writing any CSS Modules, confirm that `shared.css` custom properties (`--color-primary`, `--border-radius-*`, etc.) applied by `theme.js` to `:root` are accessible inside module files. They will be (global custom properties are always inherited), but add one `background: var(--color-primary)` rule to `Button.module.css` and verify in a browser before building all 17 modules.

> ⚠️ **Testing strategy:** Each component needs at minimum: (1) a smoke test — renders without throwing, and (2) one key-behaviour test — e.g., `Button` with `isLoading` cannot be clicked; `Alert` with `visible=false` has `aria-hidden="true"`; `Modal` calls `onClose` on Escape. Use Vitest + `@preact/testing-library`. Do not ship a component to a surface phase without at least a smoke test — regressions become very hard to diagnose once components are composed.

---

#### Phase 4: Cancel surface (warmup)

**Goal:** First full Preact surface deployed to production. Cancel is the simplest page (4 views, no calendar, no form editing) and is the right place to validate the component library in a real app context.

**Files to build:**

- [x] `src/frontend/cancel/CancelApp.tsx` — root; `useSignal<CancelView>` drives the render switch
- [x] `src/frontend/cancel/views/LoadingView.tsx` — uses `Spinner`
- [x] `src/frontend/cancel/views/ErrorView.tsx` — uses `MessageCard`
- [x] `src/frontend/cancel/views/OverviewView.tsx` — uses `BookingDetailsList`, `Button`
- [x] `src/frontend/cancel/views/SuccessView.tsx` — uses `MessageCard`
- [x] `src/frontend/cancel/hooks/useCancelBooking.ts` — fetch + signal for the cancel flow
- [x] `src/frontend/cancel/cancel.tsx` — entry point; reads `?id=` URL param, calls `render()`

**Shared components used:** `Spinner`, `MessageCard`, `BookingDetailsList`, `Button`, `StandaloneLayout`

**Dependencies:** Phase 3 complete (all shared components available and tested).

**Complexity:** Low. 4 views, no calendar, no form validation.

**Keep vanilla alive:** Do not delete `public/js/cancel.js` until the Preact version is deployed and smoke-tested end-to-end.

> ⚠️ **Risk resolved:** URL param confirmed as `?id=` (not `?ref=`/`?tenant=` as originally documented in this plan). No tenant param — the cancel page only needs the reservation UUID.

---

#### Phase 5: Booking widget (core product)

**Goal:** Migrate the revenue-critical booking flow. Highest stakes migration in the project — treat accordingly.

**Files to build:**

- [x] `src/frontend/booking-widget/BookingApp.tsx` — root; `signal<BookingStep>` (`'calendar' | 'form-step1' | 'form-step2' | 'success'`) drives the render
- [x] `src/frontend/booking-widget/views/CalendarView.tsx` — calendar step; uses `CalendarGrid`, `BlockedTooltip`, month nav
- [x] `src/frontend/booking-widget/views/Step1FormView.tsx` — guests + time step; uses `SelectedDateInfo`, `Select` ×2, `Button`, `Spinner`
- [x] `src/frontend/booking-widget/views/Step2FormView.tsx` — personal details; uses `Input` ×4, `Textarea`, `FormField` ×5, `Button`, `MessageCard` (error)
- [x] `src/frontend/booking-widget/views/SuccessView.tsx` — uses `MessageCard`, `Button`
- [x] `src/frontend/booking-widget/hooks/useTenant.ts` — loads tenant config from `?tenant=` param; manages `loading | ready | error` state
- [x] `src/frontend/booking-widget/hooks/useAvailability.ts` — fetches blocked dates + blocked times; drives `CalendarGrid` `isBlocked` / `isDisabled` props
- [x] `src/frontend/booking-widget/hooks/useBookingForm.ts` — form state, field-level validation, submit
- [x] `src/frontend/booking-widget/types/booking.ts` — `BookingFormData`, `BookingStep`, `BookingRequest`
- [x] `src/frontend/booking-widget/types/availability.ts` — `BlockedTimesResponse`, `BlockedDatesResponse`
- [x] `src/frontend/booking-widget/booking-widget.tsx` — entry point (created as `.tsx`); reads container, calls `render()`

**Note:** `BookingStep` type is `'calendar' | 'form-step1' | 'form-step2' | 'success'` — the doc had `1 | 2 | 'success'`; `'calendar'` is required as a separate initial state for the date-picker step. The calendar is its own `CalendarView` component (not merged into Step1). Slot computation uses shared `getAvailableSlots()` from `@shared/utils` (handles blocked times + today threshold). `useTenant` hook added (not in original doc) to cleanly manage tenant loading state. Step2 uses `type="submit"` + HTML5 `form.checkValidity()` matching vanilla behaviour exactly.

**Shared components used:** `CalendarGrid`, `DayCell`, `BlockedTooltip`, `SelectedDateInfo`, `Button`, `Input`, `Select`, `Textarea`, `FormField`, `Spinner`, `MessageCard`

**Dependencies:** Phase 4 complete (the deploy pipeline is proven with a live Preact surface before the most important surface is migrated).

**Complexity:** Medium-high. Two-step form, async availability fetching, calendar interaction, `theme.js` FOUC constraint.

**`theme.js` hard rule:** The widget is embedded via iframe. `theme.js` must remain a non-deferred blocking `<script>` in `booking-widget.html`'s `<head>`. Never bundle it. Preact mounts after theme vars are already applied to `:root`.

> ⚠️ **Risk — embed URL change:** If any restaurant has embedded the widget by referencing `/js/booking-form.js` directly (not via iframe `src`), that path changes post-migration. Confirm the embed mechanism before deploying. A redirect or shim may be needed.

> ⚠️ **Risk — slot generation parity:** `useAvailability.ts` must produce identical slot lists to the vanilla version. Run old and new implementations side-by-side against the same API response and confirm output is identical before deleting `public/js/booking-widget.js`.

---

#### Phase 6: Manage-booking (most complex public surface)

**Goal:** Migrate the 8-view manage-booking state machine. Reuses `CalendarGrid` (now proven in production via widget) and shares components with both the widget and cancel page.

**Files to build:**

- [x] `src/frontend/manage-booking/ManageApp.tsx` — root; `signal<ManageView>` drives the render switch
- [x] `src/frontend/manage-booking/views/LoadingView.tsx` — uses `Spinner`
- [x] `src/frontend/manage-booking/views/ErrorView.tsx` — uses `MessageCard`
- [x] `src/frontend/manage-booking/views/OverviewView.tsx` — uses `BookingDetailsList`, `Button` ×3 (edit-details, change-datetime, cancel)
- [x] `src/frontend/manage-booking/views/EditDetailsView.tsx` — uses `Input` ×4, `Textarea`, `FormField` ×5, `Button`, `Spinner`
- [x] `src/frontend/manage-booking/views/ChangeDateTimeView.tsx` — uses `CalendarGrid`, `SelectedDateInfo`, `Select` (time slots), `Button`, `Spinner`
- [x] `src/frontend/manage-booking/views/CancelConfirmView.tsx` — uses `BookingDetailsList`, `Button` ×2 (confirm + back)
- [x] `src/frontend/manage-booking/views/SuccessEditView.tsx` — uses `MessageCard`
- [x] `src/frontend/manage-booking/views/SuccessCancelView.tsx` — uses `MessageCard`
- [x] `src/frontend/manage-booking/hooks/useManageBooking.ts` — fetches reservation, orchestrates view transitions, re-fetches availability on `change-datetime`
- [x] `src/frontend/manage-booking/types/manage.ts` — `ManageView`, `EditData`, `ManageState`
- [x] `src/frontend/manage-booking/manage-booking.tsx` — entry point (`.tsx` since contains JSX render call)

**Shared components used:** `Spinner`, `MessageCard`, `BookingDetailsList`, `Button`, `Input`, `Select`, `Textarea`, `FormField`, `CalendarGrid`, `DayCell`, `BlockedTooltip`, `SelectedDateInfo`, `StandaloneLayout`

**Dependencies:** Phase 5 complete (`CalendarGrid` is proven in production via the widget before reuse here).

**Complexity:** High. 8 views, async state machine with non-trivial transitions, re-uses calendar.

> ⚠️ **Risk — state transition map:** Before building, write out every `ManageView` transition and what triggers it (API success, API error, back-button, etc.). The vanilla `manage-booking.js` has several non-obvious flows: `change-datetime` re-fetches availability on entry; `cancel-confirm` transitions back to `overview` on API error (not to an error view). Map these before you code them.

> ⚠️ **Risk — `calendar-core.js` dynamic import:** `manage-booking.js` currently does `import('/js/calendar-core.js')` at runtime. Once this phase deploys, the Preact version uses `CalendarGrid.tsx` directly — but **do not delete `calendar-core.js` yet**. The admin still imports it. Deletion happens at the end of Phase 7.

---

#### Phase 7: Admin (internal tool)

**Goal:** Migrate the admin panel. Highest total component count but lowest end-user risk (internal tool, not customer-facing). Ends with the deletion of `calendar-core.js` and all `window.*` globals.

**Files to build:**

- [ ] `src/frontend/admin/AdminApp.tsx` — root; `useAuth` hook gates the authed views
- [ ] `src/frontend/admin/hooks/useAuth.ts` — replaces `window.AdminAuth`; JWT storage, login, logout, token refresh
- [ ] `src/frontend/admin/hooks/useBookings.ts` — fetch + signal for the reservations list
- [ ] `src/frontend/admin/components/Dashboard/DateNav.tsx` — date navigation header
- [ ] `src/frontend/admin/components/Dashboard/ReservationList.tsx` — table view of bookings
- [ ] `src/frontend/admin/components/Dashboard/BookingCards.tsx` — mobile card list
- [ ] `src/frontend/admin/components/Dashboard/BookingCard.tsx` — single booking card; uses `Badge`, `Button` (action-edit, action-delete)
- [ ] `src/frontend/admin/components/BookingModal/BookingModal.tsx` — replaces `window.BookingModal`; uses shared `Modal`, `Input`, `Select`, `Textarea`, `FormField`, `Button`, `Alert`
- [ ] `src/frontend/admin/components/Settings/Settings.tsx` — tab shell
- [ ] `src/frontend/admin/components/Settings/GeneralSettings.tsx` — uses `Input`, `FormField`, `Button`
- [ ] `src/frontend/admin/components/Settings/OpeningHoursSettings.tsx` — uses `ToggleSwitch` ×7 (one per day of week), `Input`, `FormField`, `Button`
- [ ] `src/frontend/admin/components/Settings/BlockedDatesSettings.tsx` — uses `CalendarGrid` in range-select mode; `Button`
- [ ] `src/frontend/admin/admin.ts` — entry point; replaces `window.DatePicker` reference

**Shared components used:** `Button`, `Input`, `Select`, `Textarea`, `FormField`, `Alert`, `Modal`, `Badge`, `ToggleSwitch`, `CalendarGrid`, `DayCell`, `Spinner`

**Dependencies:** Phase 6 complete.

**Complexity:** High. `settings.js` is 24KB of dense imperative code. Replacing 3 `window.*` globals requires updating HTML templates atomically.

> ⚠️ **Risk — `window.*` global swap:** `window.AdminAuth`, `window.BookingModal`, `window.DatePicker` are loaded via non-module `<script src>` tags in the admin HTML templates. The migration must remove those `<script>` tags and replace them with the single Preact bundle entry point in one atomic HTML change — do not half-migrate the admin HTML or you will have a window where globals are missing but the Preact app hasn't mounted yet.

> ⚠️ **Risk — `AdminBlockedCalendar` range selection:** The `_rangeStart` / `_applyRangeStart` / hover-listener pattern in vanilla `settings.js` translates to a `rangeStart: CalendarDate | null` signal + `onMouseEnter` prop on `DayCell`. This is the most non-obvious state interaction in the entire admin. Write a test for range selection before deleting the vanilla code.

> ⚠️ **Risk — `ToggleSwitch` ×7 in opening hours:** By Phase 7, `ToggleSwitch` must be battle-tested from Phase 3. If any CSS Module `:has()` issues surfaced during Phase 3 testing, they must be fully resolved before wiring up all 7 instances here. Do not discover the CSS is broken at this stage.

> ✅ **`calendar-core.js` deletion checkpoint:** Once Phase 7 is deployed and smoke-tested, `public/js/calendar-core.js` can be deleted. Before deleting, run: `grep -r "calendar-core" public/` and confirm zero remaining references.

---

## 10. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **FOUC regression** — theme.js bundled or deferred | High | Hard rule: `theme.js` stays as a blocking `<script>` in each HTML template's `<head>`. Never bundle it. Preact mounts after this runs. |
| **`calendar-core.js` dynamic imports break** — admin does `import('/js/calendar-core.js')` at URL path | High | Migrate both widget and admin before removing vanilla files. `CalendarGrid.tsx` replaces both. Don't delete vanilla files mid-migration. |
| **Admin window globals regression** — `window.AdminAuth`, `window.BookingModal`, `window.DatePicker` | Medium | Migrate admin as a single Preact app where these become ES module hooks. Old `window.*` globals disappear and are replaced by typed function calls. |
| **`manage-booking.js` state machine regression** — 8 views, complex async, calendar + time picker | Medium | Unit test each view component in isolation before deleting the vanilla file. The `ManageView` union type makes the state machine explicit. |
| **`AdminBlockedCalendar` range selection regression** — `_rangeStart`, hover listeners, `_applyRangeStart` | Medium | The range logic is well-defined in JS; translates to `rangeStart: CalendarDate \| null` signal + `onMouseEnter` on DayCell. Write a test for range selection before deleting vanilla code. |
| **Bundle size grows** | Low | Preact runtime is ~3KB gzipped. Acceptable for a booking widget. Do not add `preact/compat` unless you need it. |
| **Build pipeline failure in CI** | Low | Add `npm run build` before `wrangler deploy` in CI. Fail fast on build errors. |
| **tsconfig conflict** — existing config covers Worker only | Low | Separate `tsconfig.frontend.json` handles this cleanly. Vite uses it; Wrangler uses the root `tsconfig.json`. |
| **Widget embed URL changes** | Low-Unknown | If restaurants embed by referencing `/js/booking-form.js` directly, the URL changes. Confirm the embed mechanism (iframe src? script injection?) before Phase 3. |

---

## 11. Recommendation

**Go ahead.** The backend is production-ready for this migration without a single route change. The frontend code has outgrown the vanilla JS pattern — the imperative DOM mutations, duplicated utilities, and zero type safety are costs that will compound as the project grows.

**Suggested first step:** Phase 1 (infrastructure) as a standalone PR. Get Vite building a working output deployed alongside the unchanged vanilla JS. Prove the deploy pipeline works. Then surface-by-surface migration.

The shared `CalendarGrid.tsx` is the pivotal piece — once that exists and both widget + admin reference it, the migration is architecturally complete. Everything else is component-by-component extraction that can be done incrementally.
