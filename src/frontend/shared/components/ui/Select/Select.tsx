import type { FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';
import { isAriaInvalid } from '@shared/utils/isAriaInvalid';

export type SelectOption = {
  value: string | number;
  label: string;
};

// `multiple` and `size` would make it a listbox, where the placeholder rule no longer applies.
type OwnedAttributes = 'class' | 'className' | 'children' | 'value' | 'defaultValue' | 'multiple' | 'size';

export type SelectProps = Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, OwnedAttributes> & {
  class?: string;
  options: SelectOption[];
  /** Selected option value. Empty, missing or not in `options` selects the placeholder (without one, the first option). */
  value?: string | number;
  /** A first, disabled option with an empty value, selected while there is no value. It is never submitted. */
  placeholder?: string;
};

/**
 * daisyUI select, full width. Every other attribute (including `aria-describedby` and `aria-invalid` from ui/Fieldset)
 * goes on the native `<select>`; `aria-invalid` also shows the error style. It has no label or error text: wrap it in
 * ui/Fieldset.
 */
const Select: FunctionComponent<SelectProps> = ({ options, value, placeholder, class: className, ...rest }) => {
  const known = value !== undefined && options.some((option) => String(option.value) === String(value));
  const selected = known ? String(value) : placeholder ? '' : undefined;

  return (
    <select {...rest} value={selected} class={cx('select w-full', isAriaInvalid(rest['aria-invalid']) && 'select-error', className)}>
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default Select;
