import type { FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

export type BadgeVariant = 'default' | 'primary';

type OwnedAttributes = 'class' | 'className';

export type BadgeProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, OwnedAttributes> & {
  class?: string;
  variant?: BadgeVariant;
};

// "default" is plain daisyUI badge (base-100 fill, base-200 border): lighter than the legacy grey chip.
// "primary" is the legacy `today` look (solid primary). The legacy tinted `primary` badge had no consumer and is not
// carried over. One size only: `badge-sm` matches the legacy 0.75rem text.
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: '',
  primary: 'badge-primary',
};

/** daisyUI badge, small. */
const Badge: FunctionComponent<BadgeProps> = ({ variant = 'default', class: className, children, ...rest }) => (
  <span {...rest} class={cx('badge badge-sm', VARIANT_CLASSES[variant], className)}>
    {children}
  </span>
);

export default Badge;
