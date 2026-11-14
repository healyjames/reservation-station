import type { FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';
import { isAriaInvalid } from '@shared/utils/isAriaInvalid';

type OwnedAttributes = 'class' | 'className';

export type TextareaProps = Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, OwnedAttributes> & {
  class?: string;
};

/**
 * daisyUI textarea, full width, 3 rows unless `rows` is given. Every other attribute (including `aria-describedby` and
 * `aria-invalid` from ui/Fieldset) goes on the native `<textarea>`; `aria-invalid` also shows the error style. It has no
 * label, hint or error text: wrap it in ui/Fieldset.
 *
 * With preact/compat loaded (it is, through the ui barrel), `onChange` fires on every keystroke like `onInput`. Use
 * `onInput` for live updates and `onBlur` to commit when the field is left.
 */
const Textarea: FunctionComponent<TextareaProps> = ({ rows = 3, class: className, ...rest }) => (
  <textarea {...rest} rows={rows} class={cx('textarea w-full', isAriaInvalid(rest['aria-invalid']) && 'textarea-error', className)} />
);

export default Textarea;
