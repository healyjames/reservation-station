import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

type OwnedAttributes =
  | 'class'
  | 'className'
  | 'children'
  | 'type'
  | 'checked'
  | 'onChange'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-checked';

export type SwapCheckboxProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, OwnedAttributes> & {
  /** Classes for the visible `<label>`. */
  class?: string;
  /** Accessible name, e.g. "Dark mode". The checked state is announced separately. */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown when checked. */
  on: ComponentChildren;
  /** Shown when not checked. */
  off: ComponentChildren;
};

/**
 * daisyUI swap (rotate) on a controlled checkbox, for a setting that is on or off. The checkbox is visually hidden and
 * keeps the focus; the label shows the focus ring. Other attributes go on the checkbox, not the label.
 */
const SwapCheckbox: FunctionComponent<SwapCheckboxProps> = ({ label, checked, onChange, on, off, class: className, ...rest }) => (
  <label
    class={cx(
      'swap swap-rotate rounded-field has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-base-content',
      className,
    )}
  >
    {/* TypeScript never checks hyphenated JSX attributes, so owned ARIA attributes are also cleared at runtime. */}
    <input
      {...rest}
      type="checkbox"
      class="sr-only"
      checked={checked}
      aria-label={label}
      aria-labelledby={undefined}
      aria-checked={undefined}
      // Truly controlled: undo the browser's toggle and let the parent's `checked` decide, so a rejected change does not
      // leave the checkbox (and the icon shown by `input:checked ~`) out of step.
      onChange={(event) => {
        const next = event.currentTarget.checked;
        event.currentTarget.checked = checked;
        onChange(next);
      }}
    />
    <span class="swap-on" aria-hidden="true">
      {on}
    </span>
    <span class="swap-off" aria-hidden="true">
      {off}
    </span>
  </label>
);

export default SwapCheckbox;
