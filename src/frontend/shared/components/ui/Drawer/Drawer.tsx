import { createContext } from 'preact';
import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { useContext, useEffect, useRef } from 'preact/hooks';
import { cx } from '@shared/utils/cx';
import Swap from '../Swap';
import type { SwapProps } from '../Swap';

/** Tailwind's lg breakpoint, where the drawer docks. Keep in step with the lg classes below. */
const DOCKED_QUERY = '(width >= 64rem)';

const isDocked = () => window.matchMedia?.(DOCKED_QUERY).matches ?? false;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DrawerContextValue = { open: boolean; sideId: string; toggle: () => void };

const DrawerContext = createContext<DrawerContextValue | null>(null);

type OwnedAttributes = 'class' | 'className' | 'children';

export type DrawerProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, OwnedAttributes> & {
  class?: string;
  /** id of the side panel; every `DrawerToggle` points `aria-controls` at it. */
  sideId: string;
  /**
   * Below lg: the overlay is shown. From lg up the drawer is docked and this means expanded (labels shown) rather than
   * collapsed to icons. Not stored anywhere; the consumer owns it.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Side panel content, e.g. a named `<nav>` with a ui/Menu. */
  side: ComponentChildren;
  /** Page content (navbar, main). Put a `DrawerToggle` in it. */
  children: ComponentChildren;
};

/**
 * daisyUI drawer, docked from lg up. A hidden checkbox mirrors `open` only so daisyUI's CSS and the drawer open/close
 * variants work; the visible control is `DrawerToggle`, a button that reports `aria-expanded`. Below lg, Esc and the
 * overlay close it; opening it from the toggle focuses the panel's first control, and Esc returns focus to the toggle.
 */
const Drawer: FunctionComponent<DrawerProps> = ({ sideId, open, onOpenChange, side, class: className, children, ...rest }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const focusPanelRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isDocked()) return;
      if (event.target instanceof Element && event.target.closest('dialog')) return;
      const panel = panelRef.current;
      if (panel?.contains(document.activeElement)) {
        Array.from(document.querySelectorAll<HTMLElement>('[aria-controls]'))
          .find((toggle) => toggle.getAttribute('aria-controls') === sideId && !panel.contains(toggle))
          ?.focus();
      }
      onOpenChangeRef.current(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, sideId]);

  // Opening the overlay from the toggle moves focus into the panel, so Tab does not walk the page under the scrim.
  useEffect(() => {
    if (!open || !focusPanelRef.current) return;
    focusPanelRef.current = false;
    const panel = panelRef.current;
    const side = sideRef.current;
    if (!panel || !side) return;
    const focusFirst = () => panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    focusFirst();
    if (panel.contains(document.activeElement)) return;
    // daisyUI delays the side's visibility change, so the panel cannot take focus until that transition starts.
    const onTransitionStart = (event: TransitionEvent) => {
      if (event.target !== side || event.propertyName !== 'visibility') return;
      side.removeEventListener('transitionstart', onTransitionStart);
      focusFirst();
    };
    side.addEventListener('transitionstart', onTransitionStart);
    return () => side.removeEventListener('transitionstart', onTransitionStart);
  }, [open]);

  const toggle = () => {
    focusPanelRef.current = !open && !isDocked();
    onOpenChange(!open);
  };

  const context: DrawerContextValue = { open, sideId, toggle };

  return (
    <DrawerContext.Provider value={context}>
      <div {...rest} class={cx('drawer lg:drawer-open', className)}>
        <input type="checkbox" class="drawer-toggle" checked={open} tabIndex={-1} aria-hidden="true" />
        <div class="drawer-content">{children}</div>
        {/* A collapsed docked panel must not clip overflow, or the menu tooltips are cut off. */}
        <div ref={sideRef} class="drawer-side lg:is-drawer-close:overflow-visible">
          <div class="drawer-overlay" data-drawer-overlay aria-hidden="true" onClick={() => onOpenChange(false)} />
          <div ref={panelRef} id={sideId} class="bg-base-200 flex min-h-full w-64 flex-col lg:is-drawer-close:w-14">
            {side}
          </div>
        </div>
      </div>
    </DrawerContext.Provider>
  );
};

type ToggleOwnedAttributes = 'active' | 'state' | 'onClick' | 'aria-controls';

export type DrawerToggleProps = Omit<SwapProps, ToggleOwnedAttributes>;

/** The drawer's toggle button: `aria-expanded` follows `open`, `aria-controls` is the side panel. Must be inside a `Drawer`. */
export const DrawerToggle: FunctionComponent<DrawerToggleProps> = (props) => {
  const drawer = useContext(DrawerContext);
  if (!drawer) throw new Error('DrawerToggle must be rendered inside a Drawer');
  // TypeScript never checks hyphenated JSX attributes, so aria-controls is also set after the spread at runtime.
  return <Swap {...props} state="expanded" active={drawer.open} onClick={drawer.toggle} aria-controls={drawer.sideId} />;
};

export default Drawer;
