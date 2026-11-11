import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { useId } from 'preact/hooks';
import { cx } from '@shared/utils/cx';

type OwnedAttributes =
  | 'class'
  | 'className'
  | 'children'
  | 'type'
  | 'checked'
  | 'defaultChecked'
  | 'disabled'
  | 'onChange'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-checked';

export type ToggleProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, OwnedAttributes> & {
  /** Classes for the `<label>` row. */
  class?: string;
  /**
   * Accessible name, shown next to the switch unless `hideLabel`. Rich content is allowed, e.g.
   * `<>Closed{' '}<span class="sr-only">on Monday</span></>` when several toggles share the visible text. Put the
   * space before the span as `{' '}`: JSX formatting drops a bare one, and name computation trims a leading space inside.
   */
  label: ComponentChildren;
  /** Keep the name for assistive tech but hide it visually (the surrounding UI already says it). */
  hideLabel?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

/**
 * daisyUI toggle (primary border and knob when on, the daisyUI look rather than the legacy filled track) on a controlled
 * checkbox inside its `<label>`. Other attributes, including `id`,
 * `disabled` and `aria-describedby`, go on the checkbox. A change the parent ignores is undone.
 */
const Toggle: FunctionComponent<ToggleProps> = ({
  label,
  hideLabel = false,
  checked,
  onChange,
  disabled = false,
  class: className,
  id,
  ...rest
}) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label
      htmlFor={inputId}
      class={cx('inline-flex cursor-pointer items-center gap-2 has-disabled:cursor-not-allowed has-disabled:opacity-50', className)}
    >
      {/* TypeScript never checks hyphenated JSX attributes, so owned ARIA attributes are also cleared at runtime. */}
      <input
        {...rest}
        id={inputId}
        type="checkbox"
        class="toggle toggle-primary"
        checked={checked}
        disabled={disabled}
        aria-label={undefined}
        aria-labelledby={undefined}
        aria-checked={undefined}
        // Truly controlled: undo the browser's toggle and let the parent's `checked` decide. Browsers fire no change on a
        // disabled checkbox; jsdom does, so it is guarded (as the legacy ToggleSwitch did).
        onChange={(event) => {
          const next = event.currentTarget.checked;
          event.currentTarget.checked = checked;
          if (!disabled) onChange(next);
        }}
      />
      <span class={hideLabel ? 'sr-only' : 'text-sm'}>{label}</span>
    </label>
  );
};

export default Toggle;
