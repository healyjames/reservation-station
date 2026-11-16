import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

type OwnedAttributes = 'class' | 'className' | 'children';

export type FieldsetMessageProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, OwnedAttributes> & {
  class?: string;
  /** The field's caption, as ui/Fieldset would show it. */
  label: string;
  /** Shows the same visual `*` as ui/Fieldset (hidden from assistive tech). */
  required?: boolean;
  /** What shows instead of the control: a loading status, or why there is nothing to choose. */
  children: ComponentChildren;
};

/**
 * ui/Fieldset's caption and spacing over a message instead of a control, so nothing shifts when the message turns into
 * the control. The caption is plain text, not a `<label>`: there is no control for it to name.
 */
const FieldsetMessage: FunctionComponent<FieldsetMessageProps> = ({ label, required = false, class: className, children, ...rest }) => (
  <div {...rest} class={cx('fieldset text-sm', className)}>
    <p class="fieldset-legend mt-0 justify-start">
      <span>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
    </p>
    {children}
  </div>
);

export default FieldsetMessage;
