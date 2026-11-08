import { createPortal } from 'preact/compat';
import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { useContext, useEffect, useId, useRef } from 'preact/hooks';
import { cx } from '@shared/utils/cx';
import Button from '../Button';
import { X } from '../icons';
import { ModalPortalContext } from '../Modal/portalTarget';

type OwnedAttributes = 'class' | 'className' | 'children' | 'id' | 'role' | 'style' | 'open';

export type FloatingTooltipProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, OwnedAttributes> & {
  class?: string;
  open: boolean;
  /** The element the tip points at. While open, it gets `aria-describedby` pointing at the tip. */
  anchor: HTMLElement | null;
  children: ComponentChildren;
  /** Called on the close button, Esc and the timeout. Without it there is no close button and no timeout. */
  onClose?: () => void;
  /** Closes the tip after this many ms (calls `onClose`). */
  timeout?: number;
};

const GAP_PX = 8;

/**
 * A tooltip opened from code, e.g. on tapping a blocked calendar date. It is rendered in a portal (on `document.body`,
 * or inside the open ui/Modal's dialog so it is not covered) and positioned above the anchor once per render (computed
 * position is the one allowed inline style; no scroll/resize tracking or viewport clamping).
 *
 * Screen readers do not announce a description added to an already-focused element, so the caller also writes the same
 * message into a persistent `role="status"` region. Re-opening on the same anchor does not restart `timeout`.
 */
const FloatingTooltip: FunctionComponent<FloatingTooltipProps> = ({
  open,
  anchor,
  children,
  onClose,
  timeout,
  class: className,
  ...rest
}) => {
  const id = useId();
  const portalTarget = useContext(ModalPortalContext) ?? document.body;
  const visible = open && anchor !== null;

  useEffect(() => {
    if (!visible || !anchor) return;
    const previous = anchor.getAttribute('aria-describedby');
    anchor.setAttribute('aria-describedby', cx(previous, id));
    return () => {
      if (previous === null) anchor.removeAttribute('aria-describedby');
      else anchor.setAttribute('aria-describedby', previous);
    };
  }, [visible, anchor, id]);

  // Callers usually pass an inline onClose; a ref keeps the timer from restarting on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closable = onClose !== undefined;

  useEffect(() => {
    if (!visible || !closable) return;
    const close = () => onCloseRef.current?.();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    const timer = timeout === undefined ? undefined : window.setTimeout(close, timeout);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      window.clearTimeout(timer);
    };
  }, [visible, anchor, closable, timeout]);

  if (!visible || !anchor) return null;

  const rect = anchor.getBoundingClientRect();

  return createPortal(
    <div
      {...rest}
      id={id}
      role="tooltip"
      style={{ top: `${rect.top - GAP_PX}px`, left: `${rect.left + rect.width / 2}px` }}
      class={cx(
        'fixed z-[1000] max-w-60 -translate-x-1/2 -translate-y-full rounded-field bg-neutral px-3 py-2 text-sm text-neutral-content shadow-lg',
        className,
      )}
    >
      <div class="flex items-start gap-2">
        <span class="flex-1">{children}</span>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            shape="circle"
            class="-me-1 -mt-1 text-neutral-content"
            aria-label="Close tooltip"
            onClick={onClose}
          >
            <X />
          </Button>
        )}
      </div>
      <span aria-hidden="true" class="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-neutral" />
    </div>,
    portalTarget,
  );
};

export default FloatingTooltip;
