import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';
import { CircleAlert, CircleCheck, Info, type IconProps } from '../icons';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';
export type AlertLive = 'assertive' | 'polite';
/** `null` renders the title as bold text that is not a heading, e.g. for an inline form error. */
export type AlertHeadingLevel = 2 | 3 | 4 | null;

type OwnedAttributes = 'class' | 'className' | 'title' | 'role' | 'aria-live';

type AlertTitle =
  | { title?: undefined; headingLevel?: undefined }
  | {
      /** Bold title above the description. */
      title: ComponentChildren;
      /** Required with `title`: the level that fits the page outline (`null` = not a heading). */
      headingLevel: AlertHeadingLevel;
    };

export type AlertProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, OwnedAttributes> &
  AlertTitle & {
    class?: string;
    variant?: AlertVariant;
    /** Shows the variant's icon (decorative). */
    icon?: boolean;
    /** Controls shown at the end, e.g. a Retry button. */
    action?: ComponentChildren;
    /**
     * Announce the alert: `assertive` gives `role="alert"`, `polite` gives `role="status"`. Leave it out for a static
     * message that is part of the page. A live region mounted together with its content is best-effort for NVDA/JAWS.
     */
    live?: AlertLive;
  };

// daisyUI's alert-soft draws the text in the raw status colour, which fails contrast on light themes, and its border is
// a 10% tint. We keep the soft tint but use base-content text and a full status-colour border (the legacy look).
const VARIANT_CLASSES: Record<AlertVariant, string> = {
  info: 'alert-info alert-soft text-base-content [--alert-border-color:var(--color-info)]',
  success: 'alert-success alert-soft text-base-content [--alert-border-color:var(--color-success)]',
  warning: 'alert-warning alert-soft text-base-content [--alert-border-color:var(--color-warning)]',
  error: 'alert-error alert-soft text-base-content [--alert-border-color:var(--color-error)]',
};

const ICON_CLASSES: Record<AlertVariant, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

const VARIANT_ICONS: Record<AlertVariant, FunctionComponent<IconProps>> = {
  info: Info,
  success: CircleCheck,
  warning: CircleAlert,
  error: CircleAlert,
};

// Explicit columns keep the message in the flexible column and the action at the end, with or without an icon. An
// empty action column would still take a grid gap, so it only exists when there is an action.
const LAYOUT_CLASSES = {
  iconAction: 'grid-cols-[auto_minmax(0,1fr)_auto]',
  icon: 'grid-cols-[auto_minmax(0,1fr)]',
  action: 'grid-cols-[minmax(0,1fr)_auto]',
  plain: 'grid-cols-1',
};

const LIVE_ATTRIBUTES: Record<AlertLive, { role: 'alert' | 'status'; 'aria-live': AlertLive }> = {
  assertive: { role: 'alert', 'aria-live': 'assertive' },
  polite: { role: 'status', 'aria-live': 'polite' },
};

const TITLE_ELEMENTS = { 2: 'h2', 3: 'h3', 4: 'h4' } as const;

const Alert: FunctionComponent<AlertProps> = ({
  variant = 'info',
  title,
  headingLevel,
  icon = true,
  action,
  live,
  class: className,
  children,
  ...rest
}) => {
  const VariantIcon = VARIANT_ICONS[variant];
  const Title = headingLevel ? TITLE_ELEMENTS[headingLevel] : 'p';
  const layout = icon ? (action ? 'iconAction' : 'icon') : action ? 'action' : 'plain';
  const liveAttributes = live ? LIVE_ATTRIBUTES[live] : { role: undefined, 'aria-live': undefined };

  // TypeScript never checks hyphenated JSX attributes, so owned ARIA attributes are also cleared at runtime.
  return (
    <div {...rest} {...liveAttributes} class={cx('alert', VARIANT_CLASSES[variant], LAYOUT_CLASSES[layout], className)}>
      {icon && <VariantIcon class={cx('size-6 self-start', ICON_CLASSES[variant])} />}
      <div>
        {title && <Title class="m-0 text-base font-bold">{title}</Title>}
        {children && <div class="*:first:mt-0 *:last:mb-0">{children}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export default Alert;
