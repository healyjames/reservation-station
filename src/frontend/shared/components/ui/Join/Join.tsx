import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

type OwnedAttributes = 'class' | 'className' | 'children' | 'role';

export type JoinProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, OwnedAttributes> & {
  class?: string;
  /**
   * The joined controls, in order. Give each one the daisyUI join item class (e.g. `<Button class="join-item">`) so it gets
   * the shared border and the outer corners. A plain text label between buttons also needs its own border colour,
   * padding and centring; see the Join row in documentation/UI_COMPONENTS.md.
   */
  children: ComponentChildren;
};

/**
 * daisyUI join: one horizontal group of controls with shared borders (prev / label / next). Name it with `aria-label`,
 * or `aria-labelledby` pointing at a visible heading, when the group's purpose is not clear from its items. No vertical variant: no current use.
 */
const Join: FunctionComponent<JoinProps> = ({ class: className, children, ...rest }) => (
  <div {...rest} role="group" class={cx('join', className)}>
    {children}
  </div>
);

export default Join;
