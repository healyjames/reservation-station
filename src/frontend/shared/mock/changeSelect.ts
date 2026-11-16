/**
 * Picks an option in a <select> and fires a native `change` event.
 * `fireEvent.change` from @testing-library/preact fires `input` instead once preact/compat is loaded
 * (Modal and Tooltip import it), which a <select onChange> never receives.
 */
export function changeSelect(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}
