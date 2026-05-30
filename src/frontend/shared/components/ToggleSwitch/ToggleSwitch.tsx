// CSS strategy: data-checked attribute on wrapper div drives track styling.
// :has(input:checked) was considered but data-checked is more reliable across
// CSS Modules scoping and test environments.
import type { FunctionComponent } from 'preact';
import styles from './ToggleSwitch.module.css';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

const ToggleSwitch: FunctionComponent<ToggleSwitchProps> = ({ checked, onChange, label, disabled, id }) => {
  const inputId = id ?? `toggle-${Math.random().toString(36).slice(2)}`;

  return (
    <label
      class={`${styles.wrapper} ${disabled ? styles.disabled : ''}`}
      htmlFor={inputId}
      data-checked={checked ? 'true' : 'false'}
    >
      <input
        type="checkbox"
        id={inputId}
        class={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => { if (!disabled) onChange((e.target as HTMLInputElement).checked); }}
      />
      <span class={styles.track} aria-hidden="true">
        <span class={styles.thumb} />
      </span>
      {label && <span class={styles.label}>{label}</span>}
    </label>
  );
};

export default ToggleSwitch;
