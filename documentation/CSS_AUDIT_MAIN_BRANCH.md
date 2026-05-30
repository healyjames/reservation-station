# CSS Audit Report - Main Branch
*Extracted: 2026-05-26*

## Overview
This document catalogs every CSS design token, component class, and styling rule from the main branch before the Preact migration. Use this as the source of truth to systematically identify and implement missing styles in new Preact components.

## File Structure

### Main CSS Files
1. **shared.css** - Core design system with all CSS custom properties
2. **styles.css** - Public-facing calendar and booking form styles  
3. **admin/styles/admin.css** - Admin dashboard styles

## Design Tokens

### Color Palette

#### Primary Colors (Stepped)
```css
--clr-primary-a0: #000000;
--clr-primary-a10: #1a0033;
--clr-primary-a20: #330066;
--clr-primary-a30: #4d0099;
--clr-primary-a40: #6600cc;
--clr-primary-a50: #8000ff;
--clr-primary-a60: #9933ff;
--clr-primary-a70: #b366ff;
--clr-primary-a80: #cc99ff;
--clr-primary-a90: #e6ccff;
```

#### Semantic Color Mappings
```css
--primary: var(--clr-primary-a60);
--primary-darker: var(--clr-primary-a50);
--primary-darkest: var(--clr-primary-a40);
--primary-lighter: var(--clr-primary-a70);
--primary-lightest: var(--clr-primary-a80);
--primary-faint: var(--clr-primary-a90);
```

#### Surface Colors (Dark Theme)
```css
--background: #0a0a0f;
--background-light: #13131a;
--background-lighter: #1c1c26;
--background-darker: #050509;
--surface: #13131a;
--surface-hover: #1c1c26;
--surface-active: #252532;
```

#### Text Colors
```css
--text-primary: #e0e0e8;
--text-secondary: #a0a0b0;
--text-tertiary: #707080;
--text-inverse: #0a0a0f;
```

#### State Colors
```css
--success: #00cc66;
--success-light: #00ff7f;
--success-dark: #009944;
--warning: #ffaa00;
--warning-light: #ffcc33;
--warning-dark: #cc8800;
--danger: #ff3333;
--danger-light: #ff6666;
--danger-dark: #cc0000;
--info: #3399ff;
--info-light: #66b3ff;
--info-dark: #0066cc;
```

#### Borders
```css
--border-subtle: #252532;
--border-primary: #33333f;
--border-secondary: #4d4d5c;
--border-focus: var(--primary);
```

### Spacing Scale
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 28px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-14: 56px;
--space-16: 64px;
```

### Border Radius
```css
--radius-xs: 4px;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 24px;
--radius-full: 9999px;
```

### Typography
```css
--font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
--font-size-xs: 0.75rem;
--font-size-sm: 0.875rem;
--font-size-base: 1rem;
--font-size-lg: 1.125rem;
--font-size-xl: 1.25rem;
--font-size-2xl: 1.5rem;
--font-size-3xl: 1.875rem;
--font-size-4xl: 2.25rem;
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Shadows
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
```

### Admin-Specific Tokens
```css
--header-height: 60px;
--sidebar-width: 250px;
--mobile-nav-height: 56px;
```

## Page-Level Styles

### HTML/Body Base
```css
html {
  box-sizing: border-box;
  font-size: 16px;
}

*, *::before, *::after {
  box-sizing: inherit;
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--font-family);
  background-color: var(--background);
  color: var(--text-primary);
  line-height: var(--line-height-normal);
}
```

## Component Classes

### Calendar Component

#### Container & Layout
```css
.calendar-container {
  background-color: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  border: 1px solid var(--border-subtle);
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.calendar-nav {
  display: flex;
  gap: var(--space-2);
}

.calendar-nav button {
  background: none;
  border: 1px solid var(--border-primary);
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.calendar-nav button:hover {
  background-color: var(--surface-hover);
  border-color: var(--border-secondary);
}
```

#### Grid & Days
```css
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-2);
}

.day-name {
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  padding: var(--space-2);
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: var(--surface);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.calendar-day:hover:not(.past):not(.empty):not(.calendar-day--blocked) {
  background-color: var(--surface-hover);
  border-color: var(--border-secondary);
}

.calendar-day.selected {
  background-color: var(--primary);
  border-color: var(--primary);
  color: var(--text-inverse);
  font-weight: var(--font-weight-semibold);
}

.calendar-day.today {
  border-color: var(--primary);
  border-width: 2px;
}

.calendar-day.past {
  opacity: 0.3;
  cursor: not-allowed;
}

.calendar-day.empty {
  visibility: hidden;
}

.calendar-day--blocked {
  background-color: var(--background-darker);
  color: var(--text-tertiary);
  cursor: not-allowed;
  text-decoration: line-through;
}
```

### Forms & Inputs

#### Form Container
```css
.form-container {
  background-color: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-8);
  border: 1px solid var(--border-subtle);
}

.form-group {
  margin-bottom: var(--space-6);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background-color: var(--background-light);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-base);
  transition: all 0.2s ease;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--border-focus);
  background-color: var(--surface);
}

.form-group input:disabled,
.form-group textarea:disabled,
.form-group select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### Field Errors
```css
.field-error {
  color: var(--danger);
  font-size: var(--font-size-sm);
  margin-top: var(--space-2);
  display: block;
}

.form-group input.error,
.form-group textarea.error,
.form-group select.error {
  border-color: var(--danger);
}
```

### Buttons

#### Primary Button
```css
button, .button {
  padding: var(--space-3) var(--space-6);
  background-color: var(--primary);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

button:hover, .button:hover {
  background-color: var(--primary-darker);
}

button:active, .button:active {
  background-color: var(--primary-darkest);
}

button:disabled, .button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### Secondary Button
```css
.button-secondary {
  background-color: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.button-secondary:hover {
  background-color: var(--surface-hover);
  border-color: var(--border-secondary);
}

.button-secondary:active {
  background-color: var(--surface-active);
}
```

### Messages & Alerts

```css
.message {
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.message-header {
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-2);
}

.success-message {
  background-color: color-mix(in srgb, var(--success) 10%, transparent);
  border: 1px solid var(--success);
  color: var(--success-light);
}

.error-message {
  background-color: color-mix(in srgb, var(--danger) 10%, transparent);
  border: 1px solid var(--danger);
  color: var(--danger-light);
}

.warning-message {
  background-color: color-mix(in srgb, var(--warning) 10%, transparent);
  border: 1px solid var(--warning);
  color: var(--warning-light);
}

.info-message {
  background-color: color-mix(in srgb, var(--info) 10%, transparent);
  border: 1px solid var(--info);
  color: var(--info-light);
}
```

### Booking Form Components

```css
.booking-form-content {
  display: grid;
  gap: var(--space-8);
}

.booking-header {
  text-align: center;
  margin-bottom: var(--space-6);
}

.booking-header h1 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-2);
}

.step-indicator {
  display: flex;
  justify-content: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.step {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background-color: var(--border-primary);
  transition: all 0.2s ease;
}

.step.active {
  background-color: var(--primary);
  width: 24px;
}

.selected-date-info {
  background-color: var(--background-light);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  text-align: center;
}
```

### Admin Dashboard Layout

#### Dashboard Grid
```css
.dashboard-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: var(--header-height) 1fr;
  grid-template-areas:
    "sidebar header"
    "sidebar main";
  min-height: 100vh;
}

.main-header {
  grid-area: header;
  background-color: var(--surface);
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-nav {
  grid-area: sidebar;
  background-color: var(--surface);
  border-right: 1px solid var(--border-subtle);
  padding: var(--space-6) 0;
}

.main-panel {
  grid-area: main;
  padding: var(--space-6);
  overflow-y: auto;
}

.page-container {
  max-width: 1200px;
  margin: 0 auto;
}
```

#### Sidebar Navigation
```css
.sidebar-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar-nav li {
  margin: var(--space-1) 0;
}

.sidebar-nav a {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-6);
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
}

.sidebar-nav a:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.sidebar-nav a.active {
  background-color: var(--surface-active);
  color: var(--primary);
  border-right: 3px solid var(--primary);
}
```

### Admin Tables

```css
.admin-table {
  width: 100%;
  border-collapse: collapse;
  background-color: var(--surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.admin-table thead {
  background-color: var(--background-light);
}

.admin-table th {
  padding: var(--space-4) var(--space-5);
  text-align: left;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--font-size-sm);
}

.admin-table td {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}

.admin-table tbody tr {
  transition: background-color 0.2s ease;
}

.admin-table tbody tr:hover {
  background-color: var(--surface-hover);
}

.admin-table tbody tr:last-child td {
  border-bottom: none;
}
```

### Booking Cards (Admin)

```css
.booking-cards {
  display: grid;
  gap: var(--space-4);
}

.booking-card {
  background-color: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  transition: all 0.2s ease;
}

.booking-card:hover {
  border-color: var(--border-secondary);
  box-shadow: var(--shadow-md);
}

.booking-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.booking-card-status {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.booking-card-status.confirmed {
  background-color: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success-light);
}

.booking-card-status.pending {
  background-color: color-mix(in srgb, var(--warning) 15%, transparent);
  color: var(--warning-light);
}

.booking-card-status.cancelled {
  background-color: color-mix(in srgb, var(--danger) 15%, transparent);
  color: var(--danger-light);
}
```

### Tabs

```css
.tabs {
  display: flex;
  gap: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: var(--space-6);
}

.tab-btn {
  padding: var(--space-3) var(--space-5);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
```

### Modals

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal {
  background-color: var(--surface);
  border-radius: var(--radius-xl);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
}

.modal-header {
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.modal-body {
  padding: var(--space-6);
}

.modal-footer {
  padding: var(--space-6);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

.modal-close {
  background: none;
  border: none;
  font-size: var(--font-size-2xl);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: var(--text-primary);
}
```

### Login Page

```css
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.login-card {
  background-color: var(--surface);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  width: 100%;
  max-width: 400px;
  border: 1px solid var(--border-subtle);
}

.login-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.login-header h1 {
  font-size: var(--font-size-3xl);
  margin-bottom: var(--space-2);
}

.login-header p {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}
```

## Utility Classes

### Screen Reader Only
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### Layout Utilities
```css
.full-width {
  width: 100%;
}

.standalone-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.standalone-card {
  background-color: var(--surface);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  max-width: 600px;
  width: 100%;
  border: 1px solid var(--border-subtle);
}
```

### Spacing Utilities
```css
.mt-0 { margin-top: 0; }
.mt-1 { margin-top: var(--space-1); }
.mt-2 { margin-top: var(--space-2); }
.mt-3 { margin-top: var(--space-3); }
.mt-4 { margin-top: var(--space-4); }
.mt-6 { margin-top: var(--space-6); }
.mt-8 { margin-top: var(--space-8); }

.mb-0 { margin-bottom: 0; }
.mb-1 { margin-bottom: var(--space-1); }
.mb-2 { margin-bottom: var(--space-2); }
.mb-3 { margin-bottom: var(--space-3); }
.mb-4 { margin-bottom: var(--space-4); }
.mb-6 { margin-bottom: var(--space-6); }
.mb-8 { margin-bottom: var(--space-8); }
```

## Responsive Design

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 767px  
- **Desktop**: ≥ 768px

### Mobile Adaptations (< 768px)

#### Admin Dashboard
```css
@media (max-width: 767px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto var(--mobile-nav-height) 1fr;
    grid-template-areas:
      "header"
      "sidebar"
      "main";
  }

  .sidebar-nav {
    display: flex;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border-subtle);
    padding: 0;
  }

  .sidebar-nav ul {
    display: flex;
  }

  .sidebar-nav a {
    white-space: nowrap;
    border-right: none;
    border-bottom: 3px solid transparent;
  }

  .sidebar-nav a.active {
    border-right: none;
    border-bottom: 3px solid var(--primary);
  }
}
```

#### Forms & Cards
```css
@media (max-width: 767px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .booking-cards {
    grid-template-columns: 1fr;
  }

  .form-container,
  .standalone-card,
  .login-card {
    padding: var(--space-6);
  }
}
```

#### Calendar
```css
@media (max-width: 640px) {
  .calendar-container {
    padding: var(--space-4);
  }

  .calendar-day {
    font-size: var(--font-size-xs);
  }
}
```

## State Classes Reference

### Interactive States
- `.hover` - Hover state (also `:hover` pseudo-class)
- `.active` - Active/selected state
- `.focus` - Focus state (also `:focus` pseudo-class)
- `.disabled` - Disabled state (also `:disabled` pseudo-class)

### Calendar-Specific States
- `.selected` - Selected date
- `.today` - Current date
- `.past` - Past dates (non-selectable)
- `.empty` - Empty calendar cells
- `.calendar-day--blocked` - Blocked/unavailable dates

### Booking States
- `.confirmed` - Confirmed booking
- `.pending` - Pending booking
- `.cancelled` - Cancelled booking

### Form Validation
- `.error` - Field with validation error

## Font Loading

### Google Sans Variable Font
```css
@font-face {
  font-family: 'Google Sans';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/googlesans/v58/4Ua_rENHsxJlGDuGo1OIlJfC6l_24rlCK1Yo_Iqcsih.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

## Notes for Preact Migration

### High Priority Classes to Implement
1. Calendar component (`.calendar-*` classes)
2. Form validation states (`.field-error`, `.error` state)
3. Button variants (primary, secondary)
4. Message components (success, error, warning, info)
5. Admin dashboard layout (`.dashboard-layout`, `.sidebar-nav`, etc.)

### CSS Custom Property Dependencies
Most components rely heavily on design tokens. Ensure all CSS custom properties from shared.css are available globally in Preact app.

### Dark Theme
All styles are built for dark theme. No light theme variants exist in main branch.

### Browser Support
Uses modern CSS features:
- CSS Grid
- CSS Custom Properties
- `color-mix()` function
- `aspect-ratio` property

### Animation/Transition Notes
All interactive elements use `transition: all 0.2s ease` for smooth state changes.

---

*End of CSS Audit Report*
