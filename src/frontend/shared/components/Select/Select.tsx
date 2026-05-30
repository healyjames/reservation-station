import type { FunctionComponent } from 'preact';
import styles from './Select.module.css';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  id?: string;
  name?: string;
  value?: string | number;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  onChange?: (e: Event) => void;
  class?: string;
}

const Select: FunctionComponent<SelectProps> = ({
  id,
  name,
  value,
  options,
  placeholder,
  required,
  disabled,
  error,
  onChange,
  class: className,
}) => (
  <div class={`${styles.wrapper} ${className ?? ''}`}>
    <select
      id={id}
      name={name}
      value={value}
      required={required}
      disabled={disabled}
      class={`${styles.select} ${error ? styles.hasError : ''}`}
      onChange={onChange}
    >
      {placeholder && (
        <option value="" disabled selected={!value}>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <span class={styles.error} role="alert">{error}</span>}
  </div>
);

export default Select;
