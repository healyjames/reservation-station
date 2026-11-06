import type { FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';
import Loading from '../Loading';

export type ButtonVariant = 'primary' | 'secondary' | 'error' | 'ghost';
export type ButtonSize = 'sm' | 'md';
export type ButtonShape = 'square' | 'circle';

type OwnedAttributes = 'class' | 'className' | 'disabled' | 'type' | 'size' | 'aria-busy';

export type ButtonProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, OwnedAttributes> & {
  class?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  block?: boolean;
  /**
   * Disables the button, marks it `aria-busy` and shows a decorative spinner; the visible text stays the accessible name.
   * Disabling a focused button drops focus to <body>, so when the request finishes, move focus to the result or status message.
   */
  isLoading?: boolean;
};

// "secondary" keeps the legacy look (neutral outline); daisyUI's btn-secondary is a solid colour.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-outline',
  error: 'btn-error',
  ghost: 'btn-ghost',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',
};

const SHAPE_CLASSES: Record<ButtonShape, string> = {
  square: 'btn-square',
  circle: 'btn-circle',
};

const Button: FunctionComponent<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  shape,
  block = false,
  isLoading = false,
  disabled = false,
  type = 'button',
  class: className,
  children,
  onClick,
  ...rest
}) => (
  <button
    {...rest}
    type={type}
    disabled={disabled || isLoading}
    onClick={disabled || isLoading ? undefined : onClick}
    aria-busy={isLoading || undefined}
    class={cx('btn', VARIANT_CLASSES[variant], SIZE_CLASSES[size], shape && SHAPE_CLASSES[shape], block && 'btn-block', className)}
  >
    {isLoading && <Loading size="sm" label={null} />}
    {children}
  </button>
);

export default Button;
