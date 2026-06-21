import type { FunctionComponent } from 'preact';
import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'sm' | 'md';
  label?: string;
}

const Spinner: FunctionComponent<SpinnerProps> = ({ size = 'md', label = 'Loading' }) => (
  <span class={`${styles.spinner} ${styles[size]}`} role="status" aria-label={label} />
);

export default Spinner;
