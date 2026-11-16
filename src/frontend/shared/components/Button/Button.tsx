import type { FunctionComponent, ComponentChildren } from 'preact';
import Spinner from '../Spinner';
import styles from './Button.module.css';

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'action-edit' | 'action-delete';
  type?: 'button' | 'submit' | 'reset';
  form?: string;
  disabled?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e: MouseEvent) => void;
  children: ComponentChildren;
  class?: string;
  'aria-label'?: string;
};

const variantClassMap: Record<string, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
  ghost: styles.ghost,
  'action-edit': styles.action_edit,
  'action-delete': styles.action_delete,
};

const Button: FunctionComponent<ButtonProps> = ({
  variant = 'secondary',
  type = 'button',
  form,
  disabled,
  isLoading,
  fullWidth,
  size = 'md',
  onClick,
  children,
  class: className,
  'aria-label': ariaLabel,
}) => (
  <button
    type={type}
    form={form}
    class={[
      styles.btn,
      variantClassMap[variant],
      styles[size],
      fullWidth ? styles.fullWidth : '',
      isLoading ? styles.loading : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ')}
    disabled={disabled || isLoading}
    aria-label={ariaLabel}
    onClick={(e) => {
      if (!disabled && !isLoading && onClick) onClick(e as MouseEvent);
    }}
    style={isLoading ? 'pointer-events: none' : undefined}
  >
    {isLoading && <Spinner size="sm" />}
    {children}
  </button>
);

export default Button;
