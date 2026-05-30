import type { FunctionComponent } from 'preact';
import styles from './Alert.module.css';

interface AlertProps {
  variant: 'error' | 'info' | 'success';
  message: string;
  visible?: boolean;
  ariaLive?: 'polite' | 'assertive';
}

const Alert: FunctionComponent<AlertProps> = ({
  variant,
  message,
  visible = true,
  ariaLive = 'polite',
}) => (
  <div
    class={`${styles.alert} ${styles[variant]} ${!visible ? styles.hidden : ''}`}
    role="alert"
    aria-live={ariaLive}
    aria-hidden={!visible ? 'true' : undefined}
  >
    {message}
  </div>
);

export default Alert;
