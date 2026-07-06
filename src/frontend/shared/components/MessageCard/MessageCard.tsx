import type { FunctionComponent, ComponentChildren } from 'preact';
import styles from './MessageCard.module.css';

type MessageCardProps = {
  variant: 'success' | 'error';
  title: string;
  children: ComponentChildren;
}

const SuccessIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ErrorIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const MessageCard: FunctionComponent<MessageCardProps> = ({ variant, title, children }) => (
  <div class={`${styles.card} ${styles[variant]}`}>
    <div class={`${styles.header} ${styles[`${variant}Header`]}`}>
      {variant === 'success' ? <SuccessIcon /> : <ErrorIcon />}
      <h4>{title}</h4>
    </div>
    <div class={styles.body}>{children}</div>
  </div>
);

export default MessageCard;
