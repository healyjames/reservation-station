import { cloneElement } from 'preact';
import type { ComponentChildren, FunctionComponent, JSX, VNode } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { cx } from '@shared/utils/cx';

type OwnedAttributes = 'class' | 'className' | 'children' | 'content';

export type TooltipProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, OwnedAttributes> & {
  class?: string;
  /** The tip text. It is the trigger's accessible description. */
  content: ComponentChildren;
  /** One element that can take focus (e.g. a button). It gets `aria-describedby` pointing at the tip. */
  children: VNode<{ 'aria-describedby'?: string }>;
};

const focusIsVisible = (target: EventTarget | null): boolean => {
  try {
    return target instanceof Element && target.matches(':focus-visible');
  } catch {
    return true;
  }
};

/**
 * daisyUI's CSS tooltip, above the trigger: shown on hover and on keyboard focus (`:focus-visible`, so not after a mouse
 * click). Esc hides it until the pointer leaves and focus moves away (WCAG 1.4.13); that Esc is consumed, so it does not
 * also close an enclosing dialog.
 */
const Tooltip: FunctionComponent<TooltipProps> = ({ content, class: className, children, onMouseEnter, onMouseLeave, ...rest }) => {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const visible = (hovered || focusVisible) && !dismissed;
  const rootRef = useRef<HTMLSpanElement>(null);

  // Added directly: JSX onFocusIn/onFocusOut did not fire under the Vitest setup (cause unconfirmed).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onFocusIn = (event: FocusEvent) => setFocusVisible(focusIsVisible(event.target));
    const onFocusOut = () => setFocusVisible(false);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    return () => {
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setDismissed(true);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [visible]);

  useEffect(() => {
    if (!hovered && !focusVisible) setDismissed(false);
  }, [hovered, focusVisible]);

  const describedBy = cx(children.props['aria-describedby'], id);

  return (
    <span
      {...rest}
      ref={rootRef}
      onMouseEnter={(event) => {
        setHovered(true);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        setHovered(false);
        onMouseLeave?.(event);
      }}
      data-dismissed={dismissed || undefined}
      class={cx('tooltip', dismissed && 'after:hidden', className)}
    >
      {cloneElement(children, { 'aria-describedby': describedBy })}
      <span id={id} role="tooltip" class="tooltip-content" hidden={dismissed}>
        {content}
      </span>
    </span>
  );
};

export default Tooltip;
