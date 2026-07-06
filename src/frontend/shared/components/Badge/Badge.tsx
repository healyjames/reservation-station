import type { FunctionComponent, ComponentChildren } from 'preact';
import styles from './Badge.module.css';

type BadgeProps = {
  variant?: 'default' | 'primary' | 'today';
  children: ComponentChildren;
  class?: string;
}

const Badge: FunctionComponent<BadgeProps> = ({ variant = 'default', children, class: className }) => (
  <span class={`${styles.badge} ${styles[variant]} ${className ?? ''}`}>{children}</span>
);

export default Badge;
