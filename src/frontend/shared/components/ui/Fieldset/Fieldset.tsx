import { cloneElement } from 'preact';
import type { ComponentChildren, FunctionComponent, JSX, VNode } from 'preact';
import { useId } from 'preact/hooks';
import { cx } from '@shared/utils/cx';
import Button from '../Button';
import Tooltip from '../Tooltip';
import { Info } from '../icons';

type ControlProps = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false' };

type OwnedAttributes = 'class' | 'className' | 'children';

export type FieldsetProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, OwnedAttributes> & {
  class?: string;
  /** Visible label text; also names the tooltip button ("More about <label>"). */
  label: string;
  /** The control's `id`, which the label points at. Defaults to the child's `id`. */
  htmlFor?: string;
  /** Shows a visual `*`. Also set `required` on the control itself, which is what assistive tech announces. */
  required?: boolean;
  /** Help text below the control, linked to it with `aria-describedby`. Hidden while there is an error. */
  hint?: ComponentChildren;
  /** Error text below the control: `role="alert"`, linked with `aria-describedby`, and sets `aria-invalid`. */
  error?: ComponentChildren;
  /** Extra explanation behind an Info button next to the label (shown on hover and keyboard focus; not on tap). */
  tooltip?: string;
  /**
   * One form control: a native input/select/textarea, or an owned ui control that spreads ARIA attributes onto its native
   * element. Render loading or empty states outside the Fieldset, not as its child.
   */
  children: VNode<ControlProps>;
};

/**
 * A labelled form control with daisyUI fieldset styling. It labels one control, so the root is a `<div>`, not a
 * `<fieldset>`/`<legend>` (which would announce a group around a single field).
 */
const Fieldset: FunctionComponent<FieldsetProps> = ({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  tooltip,
  class: className,
  children,
  ...rest
}) => {
  const baseId = useId();
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;
  const target = htmlFor ?? children.props.id;
  const hasError = Boolean(error);
  const showHint = Boolean(hint) && !hasError;

  const control = cloneElement(children, {
    'aria-describedby': cx(children.props['aria-describedby'], showHint && hintId, hasError && errorId) || undefined,
    'aria-invalid': hasError ? true : children.props['aria-invalid'],
  });

  return (
    <div {...rest} class={cx('fieldset text-sm', className)}>
      <div class="fieldset-legend justify-start">
        <span>
          <label htmlFor={target}>{label}</label>
          {required && <span aria-hidden="true"> *</span>}
        </span>
        {tooltip && (
          <Tooltip content={tooltip}>
            <Button variant="ghost" size="sm" shape="circle" class="-my-2" aria-label={`More about ${label}`}>
              <Info />
            </Button>
          </Tooltip>
        )}
      </div>
      {control}
      {showHint && (
        <p id={hintId} class="label m-0 whitespace-normal">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} role="alert" class="label m-0 whitespace-normal text-error">
          {error}
        </p>
      )}
    </div>
  );
};

export default Fieldset;
