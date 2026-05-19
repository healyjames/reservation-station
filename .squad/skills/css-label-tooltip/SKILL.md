# Skill: CSS-only label tooltip with live JS content

## Pattern

Inline a tooltip `<span>` inside a `<label>` alongside a `<button type="button" class="info-trigger">`. Show/hide via `label:has(.info-trigger:hover) .info-tooltip` — pure CSS, no JS toggle.

For **live content** inside the tooltip (values that update as the user types), use `<strong id="tt-*">` placeholders updated by a small `updateTooltip(container)` function wired to `input` events on the relevant fields.

## HTML structure

```html
<label for="my-field">
  Field label
  <button type="button" class="info-trigger" aria-label="What is this?" aria-describedby="my-tooltip">
    <span aria-hidden="true">?</span>
  </button>
  <span class="info-tooltip" id="my-tooltip" role="tooltip">
    Explanation with <strong id="tt-live-value">–</strong> live value.
  </span>
</label>
<input type="..." id="my-field" />
```

## CSS

```css
.info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid currentColor;
  background: transparent;
  font-size: 10px;
  font-weight: bold;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  vertical-align: middle;
  margin-left: 4px;
  padding: 0;
  line-height: 1;
}

.info-trigger:hover,
.info-trigger:focus {
  opacity: 1;
  outline: none;
}

.form-group label {
  position: relative;
}

.info-tooltip {
  display: none;
  position: absolute;
  left: 0;
  top: calc(100% + 6px);
  z-index: 100;
  width: 280px;
  padding: 10px 12px;
  background: var(--background-darker);
  color: var(--foreground-lightest);
  border-radius: var(--radius-xs);
  font-size: 13px;
  font-weight: normal;
  line-height: 1.5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.info-tooltip::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 16px;
  border-width: 0 5px 5px 5px;
  border-style: solid;
  border-color: transparent transparent var(--background-darker) transparent;
}

label:has(.info-trigger:hover) .info-tooltip,
label:has(.info-trigger:focus) .info-tooltip {
  display: block;
}
```

## JS (live content update)

```js
function updateTooltip(container) {
  const val = parseInt(container.querySelector('#my-field').value, 10);
  const el = container.querySelector('#tt-live-value');
  if (el) el.textContent = val > 0 ? val : 'not set';
}

container.querySelector('#my-field').addEventListener('input', () => updateTooltip(container));
updateTooltip(container); // call after fields are populated
```

## Key notes

- `type="button"` on trigger prevents form submission.
- Tooltip inside `<label>` is what enables the `:has()` selector approach.
- `pointer-events: none` on tooltip prevents it intercepting mouse events.
- `:has()` is well-supported in all modern browsers (Chrome 105+, Firefox 121+, Safari 15.4+).
- Arrow is a CSS triangle via `::before` border trick.
