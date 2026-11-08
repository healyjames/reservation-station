import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

/** Which ARIA state the button reports: a toggle (`aria-pressed`) or a disclosure such as a drawer (`aria-expanded`). */
export type SwapState = 'pressed' | 'expanded';

type OwnedAttributes = 'class' | 'className' | 'children' | 'type' | 'aria-label' | 'aria-labelledby' | 'aria-pressed' | 'aria-expanded';

export type SwapProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, OwnedAttributes> & {
  class?: string;
  /** Accessible name. Keep it the same in both states; the state is announced separately. */
  label: string;
  active: boolean;
  state?: SwapState;
  /** Shown when active. */
  on: ComponentChildren;
  /** Shown when not active. */
  off: ComponentChildren;
};

/** daisyUI swap (rotate) on a button, driven by `active`. Add `btn` classes through `class` for button styling. */
const Swap: FunctionComponent<SwapProps> = ({ label, active, state = 'pressed', on, off, class: className, ...rest }) => (
  // TypeScript never checks hyphenated JSX attributes, so owned ARIA attributes are also cleared at runtime.
  <button
    {...rest}
    type="button"
    aria-label={label}
    aria-labelledby={undefined}
    aria-pressed={state === 'pressed' ? active : undefined}
    aria-expanded={state === 'expanded' ? active : undefined}
    data-active={active || undefined}
    class={cx('swap swap-rotate', active && 'swap-active', className)}
  >
    <span class="swap-on">{on}</span>
    <span class="swap-off">{off}</span>
  </button>
);

export default Swap;
