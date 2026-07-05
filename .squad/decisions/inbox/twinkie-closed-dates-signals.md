### 2026-07-05T17:18:33+01:00: closedDates signal added to useAvailability and useManageBooking
**By:** Twinkie
**What:** Added closedDates Signal<Set<string>> to useAvailability and useManageBooking hooks. Calendar.tsx now accepts closedDates prop and switches tooltip message based on which set a blocked date belongs to.
**Why:** Frontend implementation of differentiated tooltip messages for admin-blocked vs venue-closed dates.
