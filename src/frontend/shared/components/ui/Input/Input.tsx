import type { FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';
import { isAriaInvalid } from '@shared/utils/isAriaInvalid';

type OwnedAttributes = 'class' | 'className' | 'type';

export type InputType = 'text' | 'email' | 'tel' | 'password' | 'number' | 'date' | 'time';

export type InputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, OwnedAttributes> & {
  class?: string;
  type?: InputType;
  /**
   * daisyUI validator: once the user has interacted, a red border when the native constraints fail (`:user-invalid`) and
   * a green one when they pass (`:user-valid`).
   */
  validator?: boolean;
};

/**
 * daisyUI input, full width. Every other attribute (including `aria-describedby` and `aria-invalid` from ui/Fieldset)
 * goes on the native `<input>`. It has no label, hint or error text: wrap it in ui/Fieldset. `aria-invalid` also shows
 * the error style.
 *
 * With preact/compat loaded (it is, through the ui barrel), `onChange` fires on every keystroke like `onInput`. Use
 * `onInput` for live updates and `onBlur` to commit when the field is left.
 */
const Input: FunctionComponent<InputProps> = ({ type = 'text', validator = false, class: className, ...rest }) => (
  <input
    {...rest}
    type={type}
    class={cx('input w-full', validator && 'validator', isAriaInvalid(rest['aria-invalid']) && 'input-error', className)}
  />
);

export default Input;
