import type { FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

export type StatusColor = 'primary' | 'error';
/** `sm` = 0.25rem (calendar today dot), `xl` = 1rem (legend swatch). */
export type StatusSize = 'sm' | 'xl';

type OwnedAttributes = 'class' | 'className' | 'children' | 'role' | 'aria-label' | 'aria-labelledby' | 'aria-hidden';

export type StatusProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, OwnedAttributes> & {
  /**
   * Tailwind `bg-*` utilities here beat daisyUI's colour. Stripes need a `background-image` utility, e.g.
   * `bg-[repeating-linear-gradient(...)]`; a plain `bg-<colour>` only sets `background-color`.
   */
  class?: string;
  color: StatusColor;
  /** Required: daisyUI's default `md` (0.5rem) has no consumer, and the two consumers use different sizes. */
  size: StatusSize;
  /** Accessible name. Leave it out (decorative) when nearby text or state already says it, e.g. `aria-current="date"`. */
  label?: string;
};

const COLOR_CLASSES: Record<StatusColor, string> = {
  primary: 'status-primary',
  error: 'status-error',
};

const SIZE_CLASSES: Record<StatusSize, string> = {
  sm: 'status-sm',
  xl: 'status-xl',
};

/** daisyUI status dot. Decorative unless it has a `label`. */
const Status: FunctionComponent<StatusProps> = ({ color, size, label, class: className, ...rest }) => (
  // TypeScript never checks hyphenated JSX attributes, so owned ARIA attributes are also cleared at runtime.
  <span
    {...rest}
    role={label ? 'img' : undefined}
    aria-label={label || undefined}
    aria-labelledby={undefined}
    aria-hidden={label ? undefined : 'true'}
    class={cx('status', COLOR_CLASSES[color], SIZE_CLASSES[size], className)}
  />
);

export default Status;
