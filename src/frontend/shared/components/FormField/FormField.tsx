import { useSignal } from '@preact/signals';
import type { FunctionComponent, ComponentChildren } from 'preact';
import styles from './FormField.module.css';
import Tooltip from '../Tooltip/Tooltip';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  tooltip?: string;
  required?: boolean;
  class?: string;
  children: ComponentChildren;
}

const FormField: FunctionComponent<FormFieldProps> = ({ label, htmlFor, error, hint, tooltip, required, class: className, children }) => {
  const tooltipVisible = useSignal(false);
  const tooltipAnchorRect = useSignal<DOMRect | null>(null);

  return (
    <div class={`${styles.field} ${className ?? ''}`}>
      <label
        htmlFor={htmlFor}
        onMouseEnter={tooltip ? (e) => {
          tooltipAnchorRect.value = (e.currentTarget as HTMLElement).getBoundingClientRect();
          tooltipVisible.value = true;
        } : undefined}
        onMouseLeave={tooltip ? () => {
          tooltipVisible.value = false;
        } : undefined}
      >
        {label}
        {required && ' *'}
      </label>
      {tooltip && (
        <Tooltip
          visible={tooltipVisible.value}
          message={tooltip}
          anchorRect={tooltipAnchorRect.value}
        />
      )}
      {children}
      {error && (
        <span class={styles.error} role="alert">
          {error}
        </span>
      )}
      {!error && hint && <span class={styles.hint}>{hint}</span>}
    </div>
  );
};

export default FormField;
