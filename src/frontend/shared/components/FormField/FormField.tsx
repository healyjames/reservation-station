import type { FunctionComponent, ComponentChildren } from 'preact';
import styles from './FormField.module.css';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  class?: string;
  children: ComponentChildren;
}

const FormField: FunctionComponent<FormFieldProps> = ({
  label,
  htmlFor,
  error,
  hint,
  required,
  class: className,
  children,
}) => (
  <div class={`${styles.field} ${className ?? ''}`}>
    <label htmlFor={htmlFor}>{label}{required && ' *'}</label>
    {children}
    {error && <span class={styles.error} role="alert">{error}</span>}
    {!error && hint && <span class={styles.hint}>{hint}</span>}
  </div>
);

export default FormField;
