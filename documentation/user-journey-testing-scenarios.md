# Manual User Journey Testing Scenarios

**Project:** Reservation Station (Maximum Bookings)
**Author:** Neela (QA Engineer)
**Date:** 2026-06-18
**Purpose:** Human-readable QA checklist for validating the system is production-ready. Each scenario should be performed manually against a live environment with a real tenant configuration.

---

## Prerequisites & Setup Notes

Before testing, ensure you have:
- A test tenant with a known `tenant_code` (slug) or UUID
- Admin credentials for that tenant
- A valid email inbox you can check (to verify transactional emails)
- A second browser / incognito window for concurrent booking tests
- The public base URL (e.g. `https://your-domain.com`)

**Key URL patterns:**
- Booking widget (standalone): `/booking/?tenant=<tenant_code>`
- Booking widget (embedded): `/booking/?tenant=<tenant_code>&user-journey=widget`
- Manage booking: `/booking/?id=<reservationId>&email=<email>&token=<manageToken>`
- Cancel booking: `/cancel/?id=<reservationId>&email=<email>&token=<manageToken>`
- Admin panel: `/admin/`

---

## Section 1 — Booking Widget: Standalone Mode

> **Standalone mode** = no `?user-journey=widget` param (or any value other than `widget`). The welcome banner/hero section is visible and the step forms have a `max-width: 520px` centred constraint.

---

### 1.1 — Welcome screen appearance PASS

#### Welcome banner with tenant name
**Given:** The booking page is visited at `/booking/?tenant=<valid_tenant_code>`
**When:** The page finishes loading
**Then:** A welcome heading displays `<Tenant Name> Reservations` and subtitle reads `Select a date below to check availability and book your table.`
**Notes:** Heading is `<h1>`. Verify the tenant name is exactly what is configured in settings — typos here are visible to every customer.

---

#### Welcome banner absent when tenant name is blank (edge case) PASS
**Given:** A tenant whose `name` field is empty or whitespace
**When:** The booking page loads
**Then:** The heading should fall back to `Make a Reservation` (not show a blank heading)
**Notes:** While this should never happen in prod, test with a freshly created tenant before its name is set.

---

#### Loading state PASS
**Given:** A slow network or a cold worker start
**When:** The page is loading the tenant configuration
**Then:** A spinner with label `Loading booking configuration` is shown; the calendar is not yet visible
**Notes:** On Cloudflare Workers, cold starts are rare but the spinner must appear before any content.

---

#### Invalid / missing tenant param PASS
**Given:** The page is loaded with no `?tenant=` param (e.g., `/booking/`)
**When:** The page loads
**Then:** An error card reads `Unable to load booking configuration. Please check the URL and try again.`
**Notes:** The spinner should briefly show then switch to error. No crash, no blank page.

---

#### Non-existent tenant code PASS
**Given:** The page is loaded with `?tenant=does-not-exist`
**When:** The tenant API returns 404
**Then:** The same error card as above is shown
**Notes:** Error message must NOT expose the HTTP status code or internal details to the user.

---

#### Inactive tenant TODO
**Given:** A tenant whose `status` is `cancelled` (not `active`)
**When:** The page loads (the tenant config does load), and a user tries to submit a booking
**Then:** The booking creation attempt returns a `422` error; the widget shows `Bookings are not currently available`
**Notes:** Ideally, the calendar should still load (tenant data is returned), but submission should fail with a clear message.

---

### 1.2 — Calendar Navigation

#### Initial load — current month displayed PASS
**Given:** A valid tenant is loaded
**When:** The calendar renders
**Then:** The current month and year are shown (e.g., `June 2026`); no future or past month is displayed by default
**Notes:** The calendar triggers `fetchBlockedDates` on mount. Verify availability data loads (check for brief opacity reduction while fetching).

---

#### Previous month button is disabled on current month PASS
**Given:** The calendar is showing the current month
**When:** The user inspects the previous month (`←`) button
**Then:** The button is `disabled` and cannot be clicked
**Notes:** Pressing it must do nothing. Check keyboard navigation too (Tab → Space should not navigate back).

---

#### Navigate forward to next month PASS
**Given:** The calendar is showing the current month
**When:** The user clicks the `→` (next month) button
**Then:** The calendar advances to the next month; a new `fetchBlockedDates` call is made for that month; blocked dates refresh
**Notes:** Watch for a loading opacity flash during the fetch. Once loaded, the next month's blocked/closed dates should be correctly shown.

---

#### Navigate backward after going forward PASS
**Given:** The calendar is showing a future month
**When:** The user clicks `←`
**Then:** The previous month is shown with its blocked dates refreshed
**Notes:** The previous button should never be enabled for the current month even after forward navigation.

---

#### Past dates are unselectable PASS
**Given:** The calendar is showing the current month
**When:** The user views dates before today
**Then:** Dates before today are visually greyed/disabled and cannot be selected
**Notes:** Check today's date — is it selectable? It should be. Check the date immediately before today — it must NOT be selectable.

---

#### Today is selectable (unless blocked) PASS
**Given:** Today is not blocked and not a closed day
**When:** The user clicks today's date
**Then:** The flow proceeds to Step 1 form for today's date
**Notes:** This tests the boundary condition of `isBeforeToday` — today must not be excluded.

---

#### Blocked date shows tooltip, not form PASS
**Given:** A date has been blocked by the admin (full-day block in `BlockedDates`)
**When:** The user clicks on that blocked date
**Then:** A tooltip appears with the message `Bookings currently unavailable for this date`; the Step 1 form does NOT open
**Notes:** The tooltip auto-dismisses after 3 seconds. Click elsewhere to dismiss early. The date should appear visually striped (diagonal pattern), distinct from past dates which are simply greyed.

---

#### Closed day of week is unselectable PASS
**Given:** The admin has configured Monday as a closed day in Opening Hours settings
**When:** The user views any Monday in the calendar
**Then:** Those Mondays are blocked/striped and show the tooltip on click; they do NOT open the booking form
**Notes:** This is computed client-side from `tenantConfig.opening_hours`. Verify it matches the server-side blocked-dates response for the same month.

---

#### Availability fetch error — retry button PASS
**Given:** The API call to `GET /api/reservations/blocked-dates` fails
**When:** The calendar renders
**Then:** A yellow warning banner appears with `Could not load availability. Please try again.` and a `Retry` button
**Notes:** All dates should still be visually present but the blocked state is unknown. The Retry button must trigger a fresh fetch. The calendar grid itself must NOT be hidden.

---

### 1.3 — Step 1 Form (Guests & Time)

#### Step 1 heading and navigation PASS
**Given:** A valid date has been selected
**When:** Step 1 renders
**Then:** The heading shows `Step 1 of 2`; a close/X button is visible; the selected date info is shown
**Notes:** In standalone mode, the form container has `max-width: 520px; margin: 2rem auto`. Verify this constraint is applied.

---

#### Close/X button returns to calendar PASS
**Given:** The user is on Step 1
**When:** The user clicks the X button or clicks `Change date`
**Then:** The calendar is shown again; the selected date is cleared; the time selection is cleared
**Notes:** Verify the form state is reset — if the user re-selects the same date, the time dropdown should start fresh.

---

#### Guest count dropdown range PASS
**Given:** A tenant with `max_guests = 8` and `max_covers = 20`
**When:** The guest dropdown is shown
**Then:** Options range from 2 to 8 (inclusive) — minimum is always 2, maximum is `min(max_guests, max_covers)` = 8
**Notes:** The minimum guest count of 2 is hardcoded in the widget. Party of 1 is not bookable via the widget. Confirm this is intentional with the venue owner.

---

#### Guest count dropdown when max_guests=0 (unlimited) PASS
**Given:** A tenant with `max_guests = 0` and `max_covers = 0`
**When:** The guest dropdown is shown
**Then:** Options should range from 2 to 20 (fallback when both are 0 = unlimited)
**Notes:** Test `max_guests=0, max_covers=10` → options 2–10; `max_guests=4, max_covers=0` → options 2–4.

---

#### Capacity fully used — no availability message PASS
**Given:** All capacity for the selected date has been consumed (e.g., max_covers fully booked)
**When:** The user reaches Step 1
**Then:** Both the guests dropdown and the time dropdown are replaced with an inline error: `No availability remaining for this date. Please select a different date or call us to arrange your booking.`
**Notes:** This occurs when `effectiveMaxGuests < 2`. The Next button will be disabled. Test this by having max_covers=2 and a booking of 2 guests already at every possible time.

---

#### Time slots loading state PASS
**Given:** The user has selected a date and the times API call is in progress
**When:** Step 1 is rendered
**Then:** The time field shows a spinner with label `Loading available times` and text `Loading times...`
**Notes:** The form's Next button must remain disabled while times are loading.

---

#### Blocked times are excluded from dropdown PASS
**Given:** Some time slots are fully booked for the selected date and guest count
**When:** The time dropdown renders
**Then:** Fully-booked slots do not appear as selectable options
**Notes:** This is driven by the `blocked-times` API. The API returns the blocked slots; available slots are derived by subtracting them. Confirm a blocked slot cannot be manually typed/forced.

---

#### No times available message PASS
**Given:** All available time slots for the selected date and guest count are blocked
**When:** The time field renders
**Then:** The time field is replaced with `No times available for this date with X guests. Try a different date or fewer guests.`
**Notes:** Reducing guests may free up slots (a 6-guest booking at 19:30 might block a 6-guest, but allow 2-guest). Test this by reducing guests and verifying slots reappear.

---

#### Changing guest count re-fetches blocked times PASS
**Given:** The user has selected a date and time
**When:** The user changes the guest count
**Then:** The time field is cleared; a new `fetchBlockedTimes` call is made for the new guest count; the time dropdown updates
**Notes:** Verify the time is cleared when guests change — previously selected time must not carry over and silently fail capacity check.

---

#### Next button disabled until valid selection PASS
**Given:** The user is on Step 1
**When:** Either guests is unset (below 2) or time is not selected
**Then:** The Next button is disabled and cannot be clicked
**Notes:** Both conditions must independently block the button. Test: select a time, then change guests (time clears) → button should disable again.

---

#### Opening hours — only valid slots shown PASS
**Given:** A tenant configured with opening hours 18:00–22:00 on Friday
**When:** A Friday date is selected
**Then:** Only slots from 18:00 to 21:30 appear in the time dropdown; no 12:00, 13:00 etc.
**Notes:** Slots are generated from `getAvailableSlots` which respects `tenantConfig.opening_hours`. The last slot is always `closeTime - 30min` (exclusive upper bound).

---

### 1.4 — Step 2 Form (Personal Details)

#### Step 2 heading and back button PASS
**Given:** The user has completed Step 1 and clicked Next
**When:** Step 2 renders
**Then:** Heading shows `Step 2 of 2`; a `←` back button is visible
**Notes:** In standalone mode, the form has `max-width: 520px; margin: 2rem auto`.

---

#### Back button returns to Step 1 without losing date/guest/time PASS
**Given:** The user is on Step 2
**When:** They click `←`
**Then:** Step 1 is shown; the previously selected date, guest count, and time are all retained
**Notes:** This is critical UX — the user should not have to re-select everything.

---

#### All required fields present PASS
**Given:** The user is on Step 2
**When:** They view the form
**Then:** Fields visible: First Name, Surname, Email, Phone Number (all required); Dietary Requirements (optional)
**Notes:** Check HTML `required` attributes are present. Check `autocomplete` hints: `given-name`, `family-name`, `email`, `tel`.

---

#### First name / surname max length PASS
**Given:** The user types more than 50 characters into First Name or Surname
**When:** They try to continue
**Then:** Browser native validation should prevent submission (maxLength=50)
**Notes:** The API also enforces this. Test pasting 51 chars.

---

#### Email validation PASS
**Given:** The user enters an invalid email (e.g., `notanemail`, `test@`, `@domain.com`)
**When:** They try to submit
**Then:** Browser validation prevents submission; an appropriate validation message is shown
**Notes:** Type `type="email"` provides native validation. Test edge cases: `test+tag@domain.co.uk` (valid), `test@domain` (technically valid in some parsers — verify the API's Zod `.email()` rejects this).

---

#### Phone number validation — valid formats PASS
**Given:** The user enters a valid phone number in various formats
**When:** They submit the form
**Then:** All of these should be accepted: `07700900000`, `+44 7700 900000`, `+1-555-123-4567`, `0800 123 456`
**Notes:** Pattern: `\+?[\d\s\-]{7,15}`. Check the title tooltip reads `Please enter a valid phone number (7–15 digits, e.g. +44 7700 900000)`.

---

#### Phone number validation — invalid formats PASS
**Given:** The user enters an invalid phone number
**When:** They try to submit
**Then:** Browser validation prevents submission with the `title` as the tooltip: `Please enter a valid phone number (7–15 digits, e.g. +44 7700 900000)`
**Notes:** Test: `123` (too short, < 7 digits), `abc123def456ghi` (non-digits except allowed chars), empty string (required).

---

#### Dietary requirements — optional and free text PASS
**Given:** The user leaves Dietary Requirements blank
**When:** They submit a valid booking
**Then:** The booking succeeds; dietary is stored as null/empty; the confirmation email shows `Dietary requirements: None`
**Notes:** Test with: blank, whitespace-only (should be trimmed to empty), 499 chars, exactly 500 chars, 501 chars (should be rejected by `maxLength=500`).

---

#### Submit button shows loading state PASS
**Given:** The user submits a valid form
**When:** The API call is in progress
**Then:** The button text changes to `Booking...` and shows a spinner; the button is disabled to prevent double-submission
**Notes:** This is the double-submission prevention mechanism. Test by clicking rapidly — second click must be ignored.

---

#### Successful booking submission PASS
**Given:** All fields are valid, the slot is available, the tenant is active
**When:** The user clicks `Book Now`
**Then:** A 201 response is received; the `Success` screen is shown; a confirmation email is sent to the customer and to the tenant's contact email
**Notes:** Verify the booking reference (`id`) is stored internally (the Success screen uses it for display; the confirmation email contains the manage/cancel links with this ID).

---

#### API error on submission — clear message PASS
**Given:** The API returns a 422 (e.g., slot became fully booked between Step 1 and Step 2)
**When:** The user submits
**Then:** An error card appears below the form with the server's error message (e.g., `Insufficient capacity for the requested time`)
**Notes:** The form is NOT reset — the user's entered data persists. They should be able to go back and choose a different time without re-entering their details.

---

#### Duplicate booking attempt TODO
**Given:** The same email has already booked the same date and time
**When:** The user submits again with the same email, date, and time
**Then:** A 409 error is returned; the widget shows `A reservation for this email, date, and time already exists`
**Notes:** The API enforces a UNIQUE constraint on `(email, reservation_date, reservation_time)` per the code comment.

---

#### Booking in the past rejected by API TODO
**Given:** A booking date in the past is somehow submitted (e.g., bypassing the calendar UI)
**When:** The API receives the request
**Then:** A 400 validation error is returned: `Reservation date must not be in the past`
**Notes:** This is enforced by `CreateReservationSchema.superRefine`. The calendar should prevent this, but the API is the final guard.

---

### 1.5 — Success Screen

#### Success screen content PASS
**Given:** A booking was just successfully submitted
**When:** The Success screen renders
**Then:** A green success card shows: number of guests, formatted date, selected time, customer email, and a message to use the link in the confirmation email to manage/cancel
**Notes:** Verify all details are correct — especially that the date format is human-readable (not `YYYY-MM-DD`). The booking reference is NOT shown on screen (it's in the email).

---

#### Book Another Table PASS
**Given:** The user is on the Success screen
**When:** They click `Book Another Table`
**Then:** The form is fully reset (guests back to 2, time cleared, all personal details cleared); the calendar is shown; blocked dates are re-fetched for the current month
**Notes:** If the user just filled a slot, the calendar should now reflect updated availability. Verify the previous booking's details don't bleed into the new form.

---

---

## Section 2 — Booking Widget: Embedded Mode

> **Embedded mode** = `?user-journey=widget` is present in the URL. The widget is designed to be embedded in a parent page (e.g., via iframe or custom embed script).

---

#### Welcome banner is hidden in embedded mode PASS
**Given:** The booking page is loaded with `?tenant=<code>&user-journey=widget`
**When:** The calendar renders
**Then:** The `<h1>` welcome heading (`<Tenant Name> Reservations`) and subtitle paragraph are NOT rendered
**Notes:** In standalone mode these appear above the calendar grid. In embedded mode the `isStandalone` prop is `false`, so this block is omitted.

---

#### Step forms have no max-width constraint in embedded mode PASS
**Given:** The booking page is in embedded mode
**When:** Step 1 and Step 2 forms render
**Then:** The forms do NOT have `max-width: 520px; margin: 2rem auto` applied — they fill the available container width
**Notes:** In standalone mode these constraints are applied inline. In embedded mode the `style` prop is `undefined`, so the element inherits the parent container's sizing. Verify in a narrow iframe (e.g., 350px wide) and a full-width container.

---

#### Calendar grid has no max-width constraint in embedded mode PASS
**Given:** The booking page is in embedded mode
**When:** The calendar renders
**Then:** The calendar grid wrapper does NOT have `padding: 1rem; maxWidth: 800px; margin: 0 auto` applied
**Notes:** In standalone mode this constrains the calendar to 800px. In embedded mode the grid fills its container.

---

#### All booking flow scenarios work identically in embedded mode PASS
**Given:** The booking page is in embedded mode
**When:** The user completes the full booking flow
**Then:** All steps (calendar → Step 1 → Step 2 → Success) behave identically to standalone mode, except the layout differences noted above
**Notes:** Run the full "happy path" in embedded mode: select date, select guests + time, fill details, submit. Verify email is sent, success screen appears.

---

#### Other query params coexist with user-journey=widget PASS
**Given:** The URL contains `?tenant=<code>&user-journey=widget`
**When:** The page loads
**Then:** Both `tenant` and `user-journey` are parsed correctly; the widget loads the correct tenant and enters embedded mode
**Notes:** Param order should not matter (`?user-journey=widget&tenant=<code>` should also work).

---

---

## Section 3 — Email Links & Transactional Emails

> **Important:** Emails are sent asynchronously via `c.executionCtx.waitUntil`. There may be a short delay (1–5s) before they arrive. Test with an inbox you can observe in real time.

---

### 3.1 — Customer Confirmation Email

#### Email subject and sender PASS
**Given:** A booking was successfully submitted
**When:** The confirmation email arrives
**Then:** Subject: `Your booking at <Tenant Name> is confirmed`; Sender name: `<Tenant Name> via Maximum Bookings`; Sender address: the tenant's `contact_email`
**Notes:** Check the sender is correct — this is the email address customers will reply to. If it's wrong, replies go to the wrong inbox.

---

#### Email body content PASS
**Given:** The customer confirmation email
**When:** The email is viewed
**Then:** Greeting `Hi <First Name>,`; booking details table shows: Date (`YYYY-MM-DD` format as stored), Time, Guests, Dietary requirements (`None` if not set); closing text `We look forward to seeing you!`
**Notes:** Date is displayed raw (YYYY-MM-DD) — this is a known limitation vs. a human-readable format. Verify with the business owner if this is acceptable.

---

#### Manage my booking link PASS
**Given:** The customer confirmation email
**When:** The user clicks `Manage my booking`
**Then:** The link navigates to `/booking/?id=<reservationId>&email=<customerEmail>&token=<manageToken>`; the Manage Booking page loads for that reservation
**Notes:** The token is a JWT-based manage token. Verify the link is correct — if `baseUrl`, `reservationId`, or `customerEmail` is missing, no link is shown (check the email template conditional logic). The `encodeURIComponent` on email must handle `+` signs and other special chars.

---

#### Cancel my booking link PASS
**Given:** The customer confirmation email
**When:** The user clicks `Cancel my booking`
**Then:** The link navigates to `/cancel/?id=<reservationId>&email=<customerEmail>&token=<manageToken>`; the Cancel page loads for that reservation
**Notes:** Same URL structure as manage link but different path. Verify both links are present in the same email.

---

#### Email when dietary requirements are provided PASS
**Given:** A booking was made with dietary requirements
**When:** The confirmation email arrives
**Then:** The dietary requirements row in the details table shows the user's text (not `None`)
**Notes:** Dietary text can contain special characters. Verify they render correctly in the HTML email (check for unescaped HTML entities if the text contains `<`, `>`, `&`).

---

### 3.2 — Customer Cancellation Email

#### Cancellation email subject and content PASS
**Given:** A booking has been cancelled (by customer via the cancel page)
**When:** The cancellation email arrives
**Then:** Subject: `Your booking at <Tenant Name> has been cancelled`; Body shows the cancelled booking details; closing text `We hope to see you again soon.`
**Notes:** The cancellation email does NOT contain manage/cancel links (unlike the confirmation email). Verify this is intentional — there is nothing to manage once cancelled.

---

#### No manage link in cancellation email PASS
**Given:** The customer cancellation email
**When:** The email is viewed
**Then:** There are no `Manage my booking` or `Cancel my booking` links
**Notes:** Confirmed by the template code — only the confirmation and amendment emails contain action links.

---

### 3.3 — Customer Amendment Email

#### Amendment email subject and manage link PASS
**Given:** A customer has amended their booking details or date/time
**When:** The amendment email arrives
**Then:** Subject: `Your booking at <Tenant Name> has been updated`; Body shows the UPDATED booking details; a `Manage my booking` button is present with the updated token/link
**Notes:** The amendment email has only a `Manage my booking` button (no cancel link, unlike the confirmation email). Verify the booking details shown reflect the new values, not the old ones.

---

#### Amendment email uses updated details PASS
**Given:** The customer changed their date from Jan 10 to Jan 15
**When:** The amendment email arrives
**Then:** The email shows `Jan 15` (the new date), not `Jan 10`
**Notes:** The `CustomerReservationEmailData` is populated with the data passed to the builder. If the backend sends old values, this will be wrong. Verify by doing a date change and checking the email immediately.

---

### 3.4 — Tenant / Owner Emails

#### Tenant confirmation email PASS
**Given:** A new booking is created
**When:** The tenant's contact email receives a notification
**Then:** Subject: `New booking: <First Name> <Surname> — <date> at <time>`; Body includes all booking details including: Customer Name, Email, Phone, Date, Time, Guests, Dietary Requirements, Booking ID
**Notes:** The tenant email includes the customer's phone number and email — it does NOT include manage/cancel links (the tenant uses the admin panel). Verify `Phone` and `Email` are populated even if left optional in admin-created bookings.

---

#### Tenant cancellation email PASS
**Given:** A booking is cancelled
**When:** The tenant's contact email receives a notification
**Then:** Subject: `Booking cancelled: <First Name> <Surname> — <date> at <time>`; Body shows all booking details
**Notes:** The subject format makes it easy to spot in a busy inbox. Verify name, date, and time in the subject are accurate.

---

#### Tenant amendment email PASS
**Given:** A customer amends their booking
**When:** The tenant's contact email receives a notification
**Then:** Subject: `Booking amended: <First Name> <Surname> — <date> at <time>`; Body shows UPDATED details with the Booking ID
**Notes:** The date and time in the subject should reflect the NEW booking time after amendment. Verify with a date change test.

---

### 3.5 — Email Link Behaviour: Edge Cases

#### Manage link works after amendment PASS
**Given:** The customer amends their booking and receives an amendment email
**When:** They click `Manage my booking` in the amendment email
**Then:** The Manage Booking page loads their (updated) booking details
**Notes:** The token is stable (tied to reservation ID and email), so old manage links from the confirmation email should still work after an amendment. Verify the OLD confirmation email link also still works.

---

#### Cancel link used after booking is already cancelled PASS
**Given:** A customer already cancelled their booking
**When:** They click the cancel link again from the original confirmation email
**Then:** The Cancel page loads with the error: `Booking not found. It may have already been cancelled.`
**Notes:** The API returns 404 for cancelled/deleted reservations. The UI must show a clear, user-friendly message.

---

#### Manage link with wrong email PASS
**Given:** A URL like `/booking/?id=<validId>&email=wrong@example.com&token=...`
**When:** The page loads
**Then:** The error state shows: `Booking not found. It may have already been cancelled or the link is invalid.`
**Notes:** The API checks `email.toLowerCase() === reservation.email.toLowerCase()`. Email mismatch returns 404. The token alone cannot authenticate — email is required.

---

#### Manage link with invalid/tampered reservation ID PASS
**Given:** A URL like `/booking/?id=not-a-real-id&email=test@example.com`
**When:** The page loads
**Then:** Error state shown: `Booking not found. It may have already been cancelled or the link is invalid.`
**Notes:** The API returns 404 for non-existent IDs. No error details should leak.

---

#### Email links with special characters in email TODO
**Given:** A customer whose email contains `+` (e.g., `jane+test@example.com`)
**When:** They click manage/cancel links from the email
**Then:** The `+` in the email is correctly decoded (`%2B`) in the URL and the API lookup succeeds
**Notes:** The template uses `encodeURIComponent(data.customerEmail)`. Check this encodes `+` as `%2B`. If not, the API will receive `jane test@example.com` (space) which won't match.

---

---

## Section 4 — Manage Booking Flow

**URL format:** `/booking/?id=<reservationId>&email=<email>&token=<manageToken>`

---

### 4.1 — Loading the Manage Page

#### Valid booking loads overview  PASS
**Given:** A valid `id`, `email`, and `token` from a confirmation email
**When:** The manage page loads
**Then:** A spinner is shown briefly, then the `Overview` screen appears with: Name, Date, Time, Party size, Dietary requirements (if any); three action buttons: `Edit Details`, `Change Date & Time`, `Cancel Booking`
**Notes:** Title is `Manage your booking`. Verify all booking details are displayed correctly. Dietary is shown only if non-empty.

---

#### Manage page without token (token is optional)  PASS
**Given:** A URL with `id` and `email` but no `token` parameter
**When:** The page loads
**Then:** The booking loads and the overview is shown (token is not required, just used for additional security verification)
**Notes:** Per the code, `tokenParam` is only appended if `bookingToken` is non-null. The API still validates by email match without the token.

---

#### Manage page with missing id or email  PASS
**Given:** A URL missing `id` or `email` params (e.g., `/booking/`)
**When:** The page loads
**Then:** The error state shows: `No booking reference found. Please check your link.`
**Notes:** This handles cases where a user manually navigates to the URL without parameters.

---

### 4.2 — Edit Details

#### Edit Details form pre-populates correctly  PASS
**Given:** The user is on the Manage overview
**When:** They click `Edit Details`
**Then:** The Edit Details form pre-fills with the current values: First Name, Surname, Phone, Email, Dietary Requirements, Guests
**Notes:** Verify the guest count pre-selection matches the current booking.

---

#### Back button returns to overview  PASS
**Given:** The user is on the Edit Details form
**When:** They click `← Back`
**Then:** The Overview screen is shown; no changes are saved
**Notes:** Any changes typed into the form should be discarded when navigating back.

---

#### Save changes — all fields PASS
**Given:** The user updates all editable fields with valid data
**When:** They click `Save Changes`
**Then:** A PATCH request is made; on success, the `SuccessEdit` screen shows the updated booking details; clicking `Back to booking details` returns to the Overview with updated values
**Notes:** The PATCH sends: `first_name`, `surname`, `telephone`, `email`, `dietary_requirements`, `guests`. Verify the API returns success and the UI reflects new values.

---

#### Save changes — dietary requirements cleared  PASS
**Given:** The user had dietary requirements set, and they clear the textarea
**When:** They save
**Then:** The API is sent `dietary_requirements: ''` (empty string); the booking is updated; on the overview, dietary is no longer shown
**Notes:** Clearing dietary is valid. Verify the server accepts empty string and the UI no longer renders the dietary row.

---

#### Validation prevents empty required fields  PASS
**Given:** The user clears First Name or Surname and tries to save
**When:** They click `Save Changes`
**Then:** Native browser validation fires; the form does not submit; the field is highlighted
**Notes:** `checkValidity()` and `reportValidity()` are called. This runs native HTML5 validation.

---

#### Phone validation on edit PASS
**Given:** The user enters an invalid phone number
**When:** They try to save
**Then:** Same pattern validation as the booking form: `\+?[\d\s\-]{7,15}`; browser prevents submission
**Notes:** The pattern is identical to Step 2. Verify consistent behaviour.

---

#### Guest count lower limit PASS
**Given:** The guest dropdown in Edit Details
**When:** The user views the options
**Then:** Minimum 2 guests (same as booking form); maximum is `tenantConfig.max_guests` or 20 if 0
**Notes:** Note: changing guest count does NOT re-validate against current slot capacity at the client level. If the new count exceeds remaining capacity, the server will reject with 422 on save.

---

#### API error on save  PASS
**Given:** The save API call fails (e.g., network error or 500)
**When:** The user clicks `Save Changes`
**Then:** An error card appears: `We could not save your changes. Please try again later.`; the form persists with the user's entered data
**Notes:** If the reservation was deleted, the error reads `Booking not found. It may have already been cancelled.`

---

### 4.3 — Change Date & Time

#### Change Date & Time shows calendar pre-selected on current date  PASS
**Given:** The user clicks `Change Date & Time` from the overview
**When:** The view loads
**Then:** The calendar shows the booking's current month; the current booking date is selected (highlighted); blocked dates are fetched for that month; time slots for the current date load
**Notes:** The current booking time is pre-selected IF it's still available for the (possibly changed) date. If not available, the time is left blank.

---

#### Calendar navigation and blocked dates  PASS
**Given:** The user is on the Change Date & Time view
**When:** They navigate months
**Then:** Blocked dates are fetched for each month; past dates are disabled; the same tooltip behaviour for blocked dates applies
**Notes:** Navigation is the same as the main calendar. Verify the blocked-date logic uses `tenantConfig.opening_hours` to disable closed days in addition to explicit `BlockedDates`.

---

#### Select a new date — time slots load PASS
**Given:** The user clicks a future, unblocked date
**When:** The date is selected
**Then:** Time slots for the new date load; the current booking time is auto-selected if available; otherwise the time dropdown is empty
**Notes:** The time select shows a spinner while fetching. Test a date where the old time IS available vs one where it IS NOT.

---

#### Save button disabled until time is selected PASS
**Given:** The user selected a new date but has not yet selected a time
**When:** They view the `Save Changes` button
**Then:** The button is disabled (`canSave = !!(selectedDate && selectedTime)`)
**Notes:** Selecting a date but not a time must not allow saving. Verify the button state.

---

#### Successfully saving new date/time PASS
**Given:** The user selected a new valid date and time
**When:** They click `Save Changes`
**Then:** A PATCH request updates `reservation_date` and `reservation_time`; `SuccessEdit` screen shows the new date and time; an amendment email is sent to the customer and tenant
**Notes:** This is the only place where a date change triggers an amendment email. Verify both emails arrive.

---

#### No times available on selected date PASS
**Given:** The user selects a date with no available slots (all blocked by capacity)
**When:** The time field renders
**Then:** The time select is replaced by: `No times available for this date. Please try a different date.`
**Notes:** The Save Changes button remains disabled.

---

#### Attempting to save when API rejects (capacity) TODO
**Given:** Between selecting a time and clicking Save, the slot becomes fully booked
**When:** The user clicks `Save Changes`
**Then:** An error message appears: `We could not save your changes. Please try again later.` (or 422-specific message)
**Notes:** ⚠️ Important caveat: Per `decisions.md`, the `PATCH /api/reservations/:id` route for manage-booking has **proposed but not yet implemented** full availability validation (blocked dates, capacity checks). This means changing to a blocked date via the manage flow may currently succeed when it should fail. **Flag this as a known gap.**

---

### 4.4 — Cancel via Manage Flow

#### Cancel Confirm screen PASS
**Given:** The user clicks `Cancel Booking` from the overview
**When:** The Cancel Confirm screen renders
**Then:** Title `Cancel Booking`; prompt `Are you sure you want to cancel this reservation?`; booking details listed; two buttons: `Keep My Booking` (ghost) and `Cancel My Booking` (danger/red)
**Notes:** This is distinct from the standalone Cancel page — it's the same cancel action but within the Manage flow.

---

#### Keep My Booking returns to overview PASS
**Given:** The Cancel Confirm screen
**When:** The user clicks `Keep My Booking`
**Then:** The Overview screen is shown; the booking is unchanged
**Notes:** No API call is made. State is just set back to `overview`.

---

#### Confirm cancellation — success PASS
**Given:** The user clicks `Cancel My Booking`
**When:** The API call succeeds
**Then:** `SuccessCancel` screen shows: `Your booking has been cancelled.` with the booking details
**Notes:** Both customer cancellation email and tenant cancellation email should be sent. Verify both arrive.

---

#### Cancel button shows loading state PASS
**Given:** The user clicked `Cancel My Booking`
**When:** The API call is in progress
**Then:** Button text changes to `Cancelling...` with a spinner; button is disabled
**Notes:** Prevent double-cancellation attempts.

---

---

## Section 5 — Cancel Booking Flow (Standalone)

**URL format:** `/cancel/?id=<reservationId>&email=<email>&token=<manageToken>`

---

#### Valid booking loads cancel overview PASS
**Given:** A valid cancel link from a confirmation email
**When:** The cancel page loads
**Then:** After a loading spinner, the Overview screen shows: title `Cancel your booking`; instructions `Please review the booking below...`; booking details (Name, Date, Time, Party size, Dietary if set); a red `Cancel My Booking` button
**Notes:** No "keep" or "back" option on this page — that's an intentional difference from the Manage flow's CancelConfirm. Once users are here, the expectation is they want to cancel.

---

#### Successful cancellation PASS
**Given:** The user clicks `Cancel My Booking`
**When:** The API call succeeds
**Then:** The Success screen shows: `Your booking has been cancelled.`; the customer's name, date, and time are shown
**Notes:** Verify cancellation emails are sent to both customer and tenant.

---

#### Cancel button loading state PASS
**Given:** The user clicked `Cancel My Booking`
**When:** The API call is in progress
**Then:** Button shows `Cancelling...` with spinner; button is disabled (prevents double-cancellation)
**Notes:** Important for flaky connections — user shouldn't be able to cancel twice.

---

#### API error inline (not page-level) PASS
**Given:** The cancellation API call fails
**When:** The API returns an error
**Then:** An inline error card appears above the cancel button: `We could not cancel your booking right now. Please try again later.`; the cancel button re-enables
**Notes:** The error appears within the Overview (not a full-page error). This is the `inlineError` signal — distinct from the page-level `errorMessage`.

---

#### Already-cancelled booking PASS
**Given:** The booking was already cancelled (the record no longer exists)
**When:** The cancel page loads
**Then:** Full-page error: `Booking not found. It may have already been cancelled.`
**Notes:** If the user tries to cancel a 404 booking that was already deleted, the load step returns 404, which goes to the `error` view (not `overview`).

---

#### Missing id or email params PASS
**Given:** `/cancel/` with no query params
**When:** The page loads
**Then:** Full-page error: `No booking reference found. Please check your cancellation link.`
**Notes:** This is the `useCancelBooking` guard for missing params. Check both: missing `id` only, missing `email` only, both missing.

---

#### Wrong email in cancel link PASS
**Given:** `/cancel/?id=<validId>&email=wrong@example.com`
**When:** The page loads
**Then:** Full-page error: `Booking not found. It may have already been cancelled.` (API returns 404 on email mismatch)
**Notes:** Security check — you cannot cancel another person's booking with a guessed email.

---

---

## Section 6 — Admin Panel

---

### 6.1 — Login / Authentication

#### Login page appearance PASS
**Given:** The admin page `/admin/` is loaded when not authenticated
**When:** The page renders
**Then:** A login form with: heading `Staff Sign In`, subheading `Maximum Bookings Admin`, email field, password field, `Sign in` button; a footer note `Staff access only. Not a member? Contact your manager.`
**Notes:** There is no self-service registration. New admin users must be created by a super-admin.

---

#### Successful login PASS
**Given:** Valid admin email and password
**When:** The user submits the login form
**Then:** A JWT token is issued; the user is redirected to the Dashboard; the venue name appears in the header
**Notes:** The JWT contains `userId` and `tenantId`. The token is stored client-side (check localStorage or sessionStorage). Verify the session persists on page refresh.

---

#### Invalid credentials PASS
**Given:** Wrong email or password
**When:** The user submits
**Then:** Error message: `Invalid credentials`; the form remains visible
**Notes:** The error message does NOT distinguish between wrong email and wrong password (security by design — no user enumeration).

---

#### Account lockout after 10 failed attempts TODO
**Given:** The user submits wrong credentials 10 times
**When:** The 10th failure occurs
**Then:** The account is locked; subsequent login attempts return: `Account temporarily locked. Try again later.` (HTTP 429)
**Notes:** The lockout lasts 15 minutes (`lockedUntil = Date.now() + 15 * 60 * 1000`). After 15 minutes, a correct password unlocks the account and resets `failed_attempts` to 0. Test both the lock trigger and the auto-unlock.

---

#### Empty form submission prevented PASS
**Given:** The login form is empty
**When:** The user clicks `Sign in`
**Then:** Frontend validation catches it first: `Please enter your email and password.`; no API call is made
**Notes:** This is client-side validation only — test that the API-level validation also fires if bypassed.

---

#### Session expiry banner PASS
**Given:** The admin JWT has expired
**When:** The admin page is loaded
**Then:** The login form is shown with a banner: `Your session has expired. Please sign in again.`
**Notes:** This is `auth.showExpiredBanner`. Verify the banner only shows on expiry, not on initial load.

---

#### Logout PASS
**Given:** An authenticated admin user
**When:** They click the logout button
**Then:** The token is cleared; the login form is shown; navigating back does not show dashboard content
**Notes:** Verify the token is properly cleared from storage. If using `localStorage`, the key should be absent after logout.

---

### 6.2 — Dashboard

#### Date navigation — today by default PASS
**Given:** An authenticated admin navigates to the Dashboard
**When:** The page loads
**Then:** Today's date is shown; bookings for today are fetched and displayed (or `No bookings for this date.` if none)
**Notes:** Verify the date format in the header (should be human-readable).

---

#### Navigate to previous/next day PASS
**Given:** The admin is on the Dashboard
**When:** They click the prev/next day arrows
**Then:** The date changes by 1 day; bookings for the new date are fetched and displayed
**Notes:** Verify there is no lower bound on the past (unlike the public calendar, the admin can view past days).

---

#### Bookings list displays correctly PASS
**Given:** There are bookings on the selected date
**When:** The dashboard loads
**Then:** Bookings are sorted by `reservation_time ASC`; each entry shows: name, time, guest count, and action buttons (Edit, Delete)
**Notes:** Verify sort order. The `guestCount` summary (total guests for the day) should appear in the header/DateNav area.

---

#### No bookings state PASS
**Given:** There are no bookings on the selected date
**When:** The date is shown
**Then:** `No bookings for this date.` message is shown
**Notes:** The "Block this day" toggle and "New Booking" button should still be visible even when there are no bookings.

---

#### Block this day — toggle on PASS
**Given:** The day is not blocked
**When:** The admin toggles "Block this day" ON
**Then:** A `POST /api/admin/blocked-dates` request is made for today's date (full-day block, no `start_time`); the toggle shows as ON; customers can no longer book this date
**Notes:** Existing bookings on the day are NOT affected — only new bookings are prevented. Verify by checking the public calendar: the date should now appear striped/blocked.

---

#### Block this day — toggle off PASS
**Given:** The day is blocked
**When:** The admin toggles "Block this day" OFF
**Then:** A `DELETE /api/admin/blocked-dates/date/<date>` request is made; the toggle shows as OFF; customers can now book this date again
**Notes:** Only full-day blocks (those with `start_time IS NULL`) are removed by this toggle.

---

#### Block toggle loading state PASS
**Given:** The block/unblock API call is in progress
**When:** The toggle is clicked
**Then:** The toggle is disabled during the request (`disabled={isBlockLoading.value}`)
**Notes:** Prevent rapid toggling that could create race conditions.

---

#### Create new booking from admin PASS
**Given:** The admin clicks `+ New Booking`
**When:** The modal opens
**Then:** A modal titled `New Booking` shows with fields: First Name, Surname, Telephone (optional), Email (optional), Date (pre-filled with current dashboard date), Time, Guests, Dietary Requirements
**Notes:** Note: admin-created bookings allow telephone and email as optional. Public bookings require both. A tenant confirmation email is sent; a customer email is sent only if `email` is provided.

---

#### Admin creates booking on a blocked date PASS
**Given:** The current date is blocked
**When:** The admin tries to create a booking for that date
**Then:** The API returns 422: `Bookings are not available for this date`; the modal shows the error
**Notes:** The API checks for full-day blocks even for admin-created bookings. This prevents accidentally adding bookings on blocked days.

---

#### Admin creates booking exceeding max_guests PASS
**Given:** `max_guests = 6`, admin enters guests = 10
**When:** The admin submits
**Then:** API returns 422: `Maximum party size is 6`; the modal shows the error
**Notes:** `max_guests` is enforced for admin-created bookings too.

---

#### Admin creates booking exceeding capacity (max_covers) PASS
**Given:** The slot is at full capacity
**When:** The admin submits a new booking
**Then:** API returns 422: `Insufficient capacity for the requested time`
**Notes:** The admin creation route uses the same atomic INSERT + capacity check as the public route.

---

#### Edit existing booking from admin PASS
**Given:** The admin clicks `Edit` on an existing booking
**When:** The modal opens
**Then:** The modal is titled `Edit Booking`; all fields pre-filled with current values
**Notes:** After saving, the booking list refreshes. An amendment email is NOT sent for admin-edited bookings (only for customer self-service edits). Verify this is the intended behaviour.

---

#### Delete booking from admin PASS
**Given:** The admin clicks `Delete` on an existing booking
**When:** A delete confirmation modal appears and the user confirms
**Then:** `DELETE /api/admin/reservations/:id` is called; the booking is removed from the list
**Notes:** There is a `DeleteConfirmModal`. Verify it shows the booking details before confirmation. A cancellation email is NOT sent for admin-deleted bookings (only customer self-cancellations trigger this).

---

### 6.3 — Opening Hours Configuration

#### Opening hours loads with defaults PASS
**Given:** No opening hours are configured for the tenant
**When:** The admin views Opening Hours in Settings
**Then:** All 7 days show default values: 12:00 open, 22:00 close, not closed
**Notes:** Days are displayed Monday–Sunday (UK order). The underlying `day_of_week` encoding is 0=Sunday per JS convention.

---

#### Mark a day as closed PASS
**Given:** The Opening Hours settings
**When:** The admin toggles "Closed" for Monday
**Then:** The time inputs for Monday are visually disabled (opacity 0.25); saving sends `is_closed: true, open_time: null, close_time: null` for Monday
**Notes:** The time inputs must be visually disabled AND functionally disabled. Verify the toggle affects both the desktop table view and the mobile card view.

---

#### Save opening hours — 7 rows required PASS
**Given:** The Opening Hours PUT endpoint
**When:** The admin saves with all 7 days configured
**Then:** The API accepts the PUT and saves all 7 rows atomically (DELETE old + INSERT new in a batch)
**Notes:** The API rejects any body that doesn't have exactly 7 entries. The frontend always sends 7 (one per day of week), so this should not normally fail.

---

#### Opening hours affect public calendar PASS
**Given:** Monday is saved as closed
**When:** A customer views the booking calendar
**Then:** All Mondays in the current and future months appear blocked (striped); clicking them shows the tooltip
**Notes:** This is a critical integration test. The `blocked-dates` API response includes closed days from the `OpeningHours` table. Verify it propagates correctly.

---

#### Opening hours affect time slots PASS
**Given:** Friday is saved as open 18:00–23:00
**When:** A customer selects a Friday date
**Then:** Only slots from 18:00 to 22:30 appear (last slot = `close_time - 30min`; 23:00 exclusive upper bound)
**Notes:** Test the boundary: 18:00 should be selectable, 17:30 should NOT appear. 22:30 should be selectable, 23:00 should NOT appear.

---

#### Save success/error banners PASS
**Given:** Opening hours settings
**When:** Save succeeds
**Then:** `Opening hours saved.` banner appears briefly then disappears
**When:** Save fails
**Then:** An error banner with the error message appears
**Notes:** Banners auto-dismiss after 3.5 seconds.

---

### 6.4 — Blocked Dates Configuration

#### Blocked Dates calendar loads PASS
**Given:** The admin views Blocked Dates in Settings
**When:** The component mounts
**Then:** The current month is shown; existing blocked dates are highlighted; past dates are disabled (cannot be blocked)
**Notes:** The calendar fetches `GET /api/admin/blocked-dates?month=YYYY-MM`. Only full-day blocks (no `start_time`) are shown in the calendar.

---

#### Toggle a single day blocked/unblocked PASS
**Given:** An unblocked date in the calendar
**When:** The admin clicks it once (sets range start), then clicks it again (same date = single toggle)
**Then:** The date is blocked (POST); it appears highlighted
**Notes:** Clicking the same date twice completes a single-day block. A different date would create a range.

---

#### Block a date range PASS
**Given:** The admin clicks Day 5 (first click = range start)
**When:** They hover over Day 10 (preview shows range 5–10), then click Day 10
**Then:** All dates from 5 to 10 inclusive are blocked in parallel (multiple POSTs); they all appear highlighted
**Notes:** The range selection is same-month only. Cross-month range is not supported — clicking a date in a different month from the range start acts as a single toggle instead.

---

#### Unblock a blocked date PASS
**Given:** A date is currently blocked
**When:** The admin clicks it (single toggle)
**Then:** The date is unblocked (DELETE `/api/admin/blocked-dates/date/<date>`); it reverts to normal appearance
**Notes:** Only full-day blocks (no `start_time`) can be unblocked via this UI. Partial-time blocks have a separate flow.

---

#### Past dates cannot be blocked PASS
**Given:** Dates before today
**When:** The admin views the blocked dates calendar
**Then:** Past dates are visually disabled and cannot be clicked
**Notes:** The `isDisabled` function prevents clicks on past dates. Verify this is enforced both visually and functionally.

---

### 6.5 — General Settings

#### Settings load with current values PASS
**Given:** An authenticated admin navigates to Settings → General
**When:** The form loads
**Then:** Fields pre-filled with: Venue Name, Max party size, Max venue capacity, Concurrent guest time window (minutes), Notification email address
**Notes:** The settings load from `GET /api/admin/me` (full tenant data including `contact_email`).

---

#### Change venue name PASS
**Given:** The admin updates the venue name and saves
**When:** The save completes
**Then:** `Settings saved.` banner appears; the new name appears in the admin header
**Notes:** After saving, navigate back to Dashboard to verify the header shows the new name.

---

#### Set max party size to 0 (unlimited) PASS
**Given:** `max_guests = 0`
**When:** Saved and then a customer uses the booking widget
**Then:** The guest dropdown is limited by `max_covers` (or falls back to 20 if also 0)
**Notes:** `0` means unlimited for this field. Verify the widget respects this.

---

#### Contact email warning PASS
**Given:** The admin is about to change the notification email
**When:** They view the settings form
**Then:** A yellow warning box reads: `⚠ Important: This email address is used for reservation notification emails...`
**Notes:** This is a critical warning — changing the email affects all future transactional emails. Verify the warning is prominent before any email change.

---

#### Invalid email rejected on save PASS
**Given:** The admin types an invalid email in the contact email field
**When:** They try to save
**Then:** The API returns a validation error; an error banner appears
**Notes:** The API validates with `z.email()`. The frontend also has `type="email"` native validation.

---

---

## Section 7 — Availability & Booking Rules Edge Cases

---

#### Fully booked slot — specific time slot unavailable PASS
**Given:** `max_covers = 8`, `concurrent_guests_time_limit = 120 min`; a booking of 8 guests exists at 19:00
**When:** A customer selects the same date with 2 guests
**Then:** 19:00 (and all times within the 120-minute window, i.e. 17:00–18:30) are unavailable in the time dropdown
**Notes:** Any slot where `concurrent_guests + 2 > 8` must be blocked. 17:01 onwards until the full booking clears at 21:00 (19:00 + 120min) may also be affected by the window. Carefully test boundary slots.

---

#### Partial capacity — some slots still available PASS
**Given:** `max_covers = 8`; a booking of 6 guests exists at 20:00
**When:** A customer tries to book 2 guests at 20:00
**Then:** 20:00 IS available (6 + 2 = 8 = max_covers, which satisfies the constraint `concurrent + guests <= max_covers`)
**Notes:** Test the exact boundary: 3 guests at 20:00 should be BLOCKED (6 + 3 = 9 > 8).

---

#### Rolling window — bookings at staggered times PASS
**Given:** `max_covers = 8`, `concurrent_guests_time_limit = 120 min`; Booking A: 8 guests at 20:00
**When:** A customer selects 20:30
**Then:** 20:30 is blocked (concurrent with Booking A; 20:30 - 20:00 = 30 min < 120 min limit; 8 + any > 8)
**When:** A customer selects 22:00
**Then:** 22:00 is available (Booking A at 20:00 + 120min = 22:00; the boundary condition is `< timeLimitMinutes`, so 22:00 - 20:00 = 120 is NOT concurrent)
**Notes:** This tests the exclusive upper bound in `calculateConcurrentGuests`. 22:00 should be available; 21:59 should not.

---

#### Concurrent booking race condition PASS
**Given:** Two customers simultaneously view an available slot with 1 seat remaining
**When:** Both submit at the same time
**Then:** Exactly one booking succeeds (201); the other receives 422 `Insufficient capacity for the requested time`
**Notes:** The backend uses an atomic INSERT with a WHERE clause that re-evaluates capacity — this eliminates the SELECT-then-INSERT race condition. Test with two browser windows submitting simultaneously.

---

#### max_guests vs max_covers independence PASS
**Given:** `max_guests = 4`, `max_covers = 20`
**When:** A customer tries to book 6 guests in the widget
**Then:** The guest dropdown only shows 2, 3, 4 (max_guests limit); 6 is not selectable
**Notes:** Also test API-level: a direct POST with guests=6 should return 422 `Maximum party size is 4`.

---

#### max_covers = 0 — unlimited venue PASS
**Given:** `max_covers = 0` (unlimited)
**When:** Any number of bookings are made
**Then:** No slot is ever blocked by capacity; the time dropdown always shows all available times; the API never returns capacity errors
**Notes:** The WHERE clause in the INSERT uses `(? = 0) OR ...` to short-circuit unlimited venues. This must be tested explicitly.

---

#### Date fully blocked in blocked-dates response PASS
**Given:** A date is fully blocked (admin toggled "Block this day")
**When:** The public calendar renders
**Then:** That date appears striped and the tooltip shows on click
**Notes:** Verify the `blocked-dates` API correctly returns this date in `blocked_dates[]`. Also verify the `blocked-times` API returns ALL time slots as blocked for that date.

---

#### Opening hours — closed day prevents booking PASS
**Given:** A day of the week is marked as closed
**When:** The customer navigates to that day on the calendar
**Then:** That day is visually blocked (striped); clicking it shows the tooltip; it cannot be booked
**Notes:** Even if the customer bypasses the UI and sends a direct API POST, the server rejects it with 422 `Bookings are not available for this date` (closing hours is enforced server-side too).

---

#### Opening hours — outside-hours time rejected by API PASS
**Given:** Opening hours are 18:00–23:00; a direct API POST is made with `reservation_time: "12:00"`
**When:** The API processes the request
**Then:** 422 error: `Bookings are not available for this time`
**Notes:** The API enforces opening hours for time slots too, not just dates. The widget never shows out-of-hours slots, but the server-side guard is the safety net.

---

#### Far-future dates accessible in calendar PASS
**Given:** A tenant with no end-date restriction
**When:** A customer navigates the calendar forward several years
**Then:** The calendar keeps advancing; blocked dates are fetched for each month (server-side dates are correctly returned)
**Notes:** There is no upper limit on calendar navigation. Test navigating 2+ years ahead. Verify the API accepts future month params (e.g., `month=2028-12`).

---

#### Booking exactly on the boundary of today PASS
**Given:** Today is June 18, 2026
**When:** A customer tries to book June 18 (today)
**Then:** Today IS selectable in the calendar (not blocked by `isBeforeToday`)
**Notes:** The `isBeforeToday` function uses strict less-than comparison for the day. Today must not be excluded.

---

---

## Section 8 — Error & Resilience Scenarios

---

### 8.1 — API Down / Network Failure

#### Tenant load failure
**Given:** The API is unreachable when the booking widget loads
**When:** `GET /api/tenants/:id` times out or fails
**Then:** Error state: `Unable to load booking configuration. Please check the URL and try again.`
**Notes:** No spinner persists indefinitely — the error must eventually display. Verify by blocking the network request in DevTools.

---

#### Blocked dates fetch failure at calendar
**Given:** The tenant loads successfully but `GET /api/reservations/blocked-dates` fails
**When:** The calendar renders
**Then:** Yellow warning banner with retry button appears; the calendar grid is still shown (fails open)
**Notes:** The system must NOT prevent the calendar from rendering — it should fail open (display dates but without accurate blocked state) rather than fail closed (show nothing).

---

#### Blocked times fetch failure at Step 1
**Given:** `GET /api/reservations/blocked-times` fails
**When:** A date is selected and Step 1 renders
**Then:** The time dropdown shows all slots (unfiltered) because `blockedTimes` defaults to empty `[]` on error
**Notes:** This is a potential over-permissive failure — the user sees all times as available, but the booking submission will still fail if the slot is at capacity (server-side guard). The UX is non-ideal but safe.

---

#### Booking submission failure — network error
**Given:** `POST /api/reservations` fails with a network error (not an HTTP error)
**When:** The user submits Step 2
**Then:** Error card appears: `Network error. Please check your connection and try again.`; the form is not reset
**Notes:** This catches the `catch` block in `useBookingForm`. The user's data is preserved for retry.

---

#### Admin API failure during dashboard load
**Given:** The admin is authenticated but the bookings API fails
**When:** `GET /api/admin/reservations` fails
**Then:** An error message is shown in the booking list area
**Notes:** The error must not log the user out. Only a 401 response should trigger logout.

---

### 8.2 — Invalid / Tampered Parameters

#### Booking widget — tenant is a UUID (vs. tenant_code)
**Given:** The tenant endpoint accepts both UUID and tenant_code
**When:** The page loads with `?tenant=<UUID>`
**Then:** The tenant config loads correctly (the API auto-detects UUID vs. slug)
**Notes:** Per `decisions.md`, the UUID detection uses a regex. If a `tenant_code` coincidentally matches the UUID pattern, it would be treated as a UUID and return 404. This is documented as an acceptable theoretical risk.

---

#### Manage page — tampered token
**Given:** The URL has a valid `id` and `email` but a tampered/invalid `token`
**When:** The manage page loads
**Then:** The booking still loads (token verification is supplementary; email is the primary auth)
**Notes:** ⚠️ If the token format is invalid (malformed JWT) rather than just wrong, check whether this causes an unhandled error on the server. The manage token is currently optional — absence or invalidity should gracefully degrade.

---

#### Cancel page — missing token (token optional)
**Given:** A cancel URL without the `token` param
**When:** The cancel page loads
**Then:** The booking loads and the cancel overview is shown (token is not required)
**Notes:** Token is `tokenParam = bookingToken ? `&token=...` : ''`. Without token, the fetch still goes through and email is the primary authentication.

---

### 8.3 — Double Submission Prevention

#### Booking form double-click prevention
**Given:** The user is on Step 2 and clicks `Book Now`
**When:** The API call is in progress
**Then:** The `isSubmitting` signal is `true`; `submitBooking` returns early if called again; the button is disabled
**Notes:** Test by clicking the button repeatedly and fast. Only one API call should be made. Verify in the Network tab.

---

#### Cancel double-click prevention (standalone)
**Given:** The user clicked `Cancel My Booking` and the API call is in progress
**When:** They click again
**Then:** `isCancelling` signal prevents a second call (`if (isCancelling.value ...) return`)
**Notes:** Verify with a slow network (throttle to Slow 3G in DevTools).

---

#### Manage booking save double-click prevention
**Given:** The user clicked `Save Changes` in EditDetails
**When:** The API call is in progress
**Then:** `isSaving` signal is true; button shows `Saving...` with spinner; further clicks are effectively no-ops
**Notes:** Both EditDetails and ChangeDateTime components use local `isSaving` signals.

---

### 8.4 — Browser Navigation

#### Browser back button during booking flow
**Given:** The user is on Step 1 or Step 2 of the booking widget
**When:** They press the browser's back button
**Then:** The browser navigates to the previous page in history (outside the widget); the widget itself does not intercept the browser back button
**Notes:** The booking flow uses React-like signals, not browser history. The browser's back button will exit the booking widget entirely (going to the referrer page). This is expected behaviour — the widget's step navigation uses the in-app back/close buttons.

---

#### Refreshing the page mid-booking
**Given:** The user is on Step 2 of the booking form
**When:** They refresh the browser
**Then:** The page resets to the calendar (Step 1); all form data is lost
**Notes:** There is no localStorage/sessionStorage persistence of form state. This is expected behaviour. The user must start the booking again. Inform the business owner this is the current UX.

---

#### Multiple tabs — concurrent booking
**Given:** The user opens the booking widget in two browser tabs
**When:** Both tabs select the last available slot and one submits successfully
**Then:** The other tab's submission fails with 422 (capacity check); the second tab shows an appropriate error
**Notes:** This tests the atomic INSERT guard against race conditions. See Section 7 (concurrent booking race condition) for the detailed test.

---

### 8.5 — Session Expiry (Admin)

#### Admin JWT expires during session
**Given:** The admin is using the dashboard; the JWT expires (default expiry in the JWT configuration)
**When:** An authenticated API call is made (e.g., fetching bookings for the next day)
**Then:** The API returns 401; `adminAuth` middleware rejects; the admin is logged out; the login form reappears with the session-expiry banner
**Notes:** Verify the `showExpiredBanner` state is set when the 401 triggers logout (vs. a fresh load). The banner should only show on expiry, not on first visit.

---

#### Admin tries to access dashboard without JWT
**Given:** No token in localStorage/sessionStorage
**When:** The admin page loads
**Then:** The login form is shown immediately (no dashboard flicker)
**Notes:** The `useAuth` hook checks for a token on mount. The `isLoading` state ensures the spinner shows briefly, then login appears — not the dashboard.

---

### 8.6 — Combined Edge Cases

#### Max capacity + concurrent bookings on same date (stress scenario)
**Given:** `max_covers = 10`, `concurrent_guests_time_limit = 90 min`; existing bookings: 6 guests at 19:00, 3 guests at 20:00
**When:** A new customer tries to book 2 guests at 19:30
**Then:** 19:30 is BLOCKED — concurrent guests at 19:30 = 6 (from 19:00, within 90 min) + 3 (from 20:00, within 90 min back: 20:00 is 30 min ahead of 19:30, which is < 90 min) = 9; 9 + 2 = 11 > 10
**Notes:** This tests the sliding window from both sides. The `calculateConcurrentGuests` function sums all reservations where `|slot - booking| < timeLimitMinutes`. Trace through the logic manually.

---

#### Blocked date + attempt to book via API bypass
**Given:** The admin has blocked a date; the public calendar shows it as blocked
**When:** A technically savvy user directly sends a `POST /api/reservations` with that blocked date
**Then:** API returns 422: `Bookings are not available for this date`
**Notes:** The server MUST enforce this independently of the frontend. Never rely solely on client-side availability checks.

---

#### Closed day + opening hours + blocked dates — union
**Given:** Saturday is configured as closed (opening hours); AND Saturday Dec 25 has an explicit full-day blocked date entry
**When:** The blocked-dates API returns dates for December
**Then:** ALL Saturdays in December appear blocked (from opening hours), PLUS Dec 25 appears blocked (from explicit block); no duplicates, no errors
**Notes:** The `blocked-dates` endpoint unions closed days from opening hours with explicit `BlockedDates` entries. Verify deduplication works correctly with a `Set`.

---

---

*Document prepared by Neela, QA Engineer. Last updated 2026-06-18.*
