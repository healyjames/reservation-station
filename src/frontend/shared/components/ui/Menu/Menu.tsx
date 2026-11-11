import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { cx } from '@shared/utils/cx';

type MenuOwnedAttributes = 'class' | 'className' | 'children';

export type MenuProps = Omit<JSX.HTMLAttributes<HTMLUListElement>, MenuOwnedAttributes> & {
  class?: string;
  /** `MenuItem`s, or `<li>`s with other controls (e.g. the theme toggle). */
  children: ComponentChildren;
};

/** daisyUI menu: a `<ul>`. Put it inside a named `<nav>` when it is navigation. */
const Menu: FunctionComponent<MenuProps> = ({ class: className, children, ...rest }) => (
  <ul {...rest} class={cx('menu', className)}>
    {children}
  </ul>
);

type ItemOwnedAttributes =
  | 'class'
  | 'className'
  | 'children'
  | 'href'
  | 'type'
  | 'aria-current'
  | 'aria-label'
  | 'aria-labelledby'
  | 'data-tip';

export type MenuItemProps = Omit<JSX.HTMLAttributes<HTMLElement>, ItemOwnedAttributes> & {
  /** Classes for the `<li>`. Other attributes (`id`, `onClick`, `data-*`…) go on the link or button. */
  class?: string;
  /**
   * Visible text and accessible name. Hidden visually (not from assistive tech) while the docked drawer (lg and up) is
   * collapsed; below lg the overlay is never "collapsed", so it does not switch mid-slide.
   */
  label: string;
  /** A decorative icon, e.g. `<CalendarDays />`. */
  icon?: ComponentChildren;
  /** Renders a link; without it, a `type="button"` button. */
  href?: string;
  /** The current page: `aria-current="page"`, which daisyUI styles as the active item. */
  active?: boolean;
  /**
   * Shows the label as a tooltip to the right while the drawer is collapsed. Only for menus inside the drawer, whose side
   * panel (and any scrolling wrapper) must not clip overflow while collapsed, or the tip is cut off. Class names are kept
   * out of this comment: Tailwind would generate them.
   */
  tooltip?: boolean;
};

/**
 * One menu entry. The collapsed-drawer tooltip is daisyUI's CSS `data-tip` on the `<li>` (hover and keyboard focus). Esc
 * hides it until the pointer leaves and focus moves away (WCAG 1.4.13 dismissible; like ui/Tooltip, the tip itself is not
 * hoverable). The Esc is not consumed: the tip only repeats the name, and the overlay drawer also closes on Esc. The tip
 * is generated content, so a screen reader may read the label twice while collapsed (accepted; checked in subtask 33).
 */
export const MenuItem: FunctionComponent<MenuItemProps> = ({
  label,
  icon,
  href,
  active = false,
  tooltip = false,
  class: className,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!tooltip || dismissed || !(hovered || focused)) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissed(true);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [tooltip, dismissed, hovered, focused]);

  useEffect(() => {
    if (!hovered && !focused) setDismissed(false);
  }, [hovered, focused]);

  const content = (
    <>
      {icon}
      <span class="lg:is-drawer-close:sr-only">{label}</span>
    </>
  );
  // TypeScript never checks hyphenated JSX attributes, so owned ARIA attributes are also cleared at runtime.
  const shared = {
    ...rest,
    'aria-current': active ? ('page' as const) : undefined,
    'aria-label': undefined,
    'aria-labelledby': undefined,
    onFocus: (event: JSX.TargetedFocusEvent<HTMLElement>) => {
      setFocused(true);
      onFocus?.(event);
    },
    onBlur: (event: JSX.TargetedFocusEvent<HTMLElement>) => {
      setFocused(false);
      onBlur?.(event);
    },
  };

  return (
    <li
      data-tip={tooltip ? label : undefined}
      data-dismissed={dismissed || undefined}
      onMouseEnter={tooltip ? () => setHovered(true) : undefined}
      onMouseLeave={tooltip ? () => setHovered(false) : undefined}
      // Plain tooltip classes hidden while the drawer is open, rather than the drawer-close variant of `tooltip`: that copies
      // daisyUI's whole tooltip stylesheet (~13 kB) under a new selector.
      class={cx(
        tooltip && 'tooltip tooltip-right is-drawer-open:before:hidden is-drawer-open:after:hidden',
        dismissed && 'before:hidden after:hidden',
        className,
      )}
    >
      {href !== undefined ? (
        <a {...shared} href={href}>
          {content}
        </a>
      ) : (
        <button {...shared} type="button">
          {content}
        </button>
      )}
    </li>
  );
};

export default Menu;
