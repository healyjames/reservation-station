import type { FunctionComponent } from 'preact';
import styles from './Textarea.module.css';

type TextareaProps = {
  id?: string;
  name?: string;
  value?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  onInput?: (e: Event) => void;
  class?: string;
}

const Textarea: FunctionComponent<TextareaProps> = ({
  id,
  name,
  value,
  placeholder,
  rows = 3,
  maxLength,
  required,
  disabled,
  hint,
  onInput,
  class: className,
}) => (
  <div class={`${styles.wrapper} ${className ?? ''}`}>
    <textarea
      id={id}
      name={name}
      value={value}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      required={required}
      disabled={disabled}
      class={styles.textarea}
      onInput={onInput}
    />
    {hint && <span class={styles.hint}>{hint}</span>}
  </div>
);

export default Textarea;
