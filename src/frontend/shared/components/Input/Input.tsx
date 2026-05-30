import type { FunctionComponent } from 'preact';
import styles from './Input.module.css';

interface InputProps {
  type?: 'text' | 'email' | 'tel' | 'password' | 'number' | 'date' | 'time' | 'search';
  id?: string;
  name?: string;
  value?: string | number;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  minLength?: number;
  min?: string | number;
  pattern?: string;
  title?: string;
  autocomplete?: string;
  error?: string;
  hint?: string;
  ariaInvalid?: boolean;
  onInput?: (e: Event) => void;
  onChange?: (e: Event) => void;
  class?: string;
}

const Input: FunctionComponent<InputProps> = ({
  type = 'text',
  id,
  name,
  value,
  placeholder,
  required,
  disabled,
  maxLength,
  minLength,
  min,
  pattern,
  title,
  autocomplete,
  error,
  hint,
  ariaInvalid,
  onInput,
  onChange,
  class: className,
}) => (
  <div class={`${styles.wrapper} ${className ?? ''}`}>
    <input
      type={type}
      id={id}
      name={name}
      value={value}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      maxLength={maxLength}
      minLength={minLength}
      min={min}
      pattern={pattern}
      title={title}
      autocomplete={autocomplete}
      class={`${styles.input} ${error ? styles.hasError : ''}`}
      aria-invalid={ariaInvalid ? 'true' : undefined}
      onInput={onInput}
      onChange={onChange}
    />
    {error && <span class={styles.error} role="alert">{error}</span>}
    {!error && hint && <span class={styles.hint}>{hint}</span>}
  </div>
);

export default Input;
