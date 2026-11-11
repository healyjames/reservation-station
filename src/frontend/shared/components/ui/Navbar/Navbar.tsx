import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

/**
 * `header` is the banner landmark when it is not inside `main`, `article`, `aside`, `nav` or `section`; `nav` is a
 * navigation landmark (name it with `aria-label`); `div` is no landmark.
 */
export type NavbarElement = 'header' | 'nav' | 'div';

type OwnedAttributes = 'class' | 'className' | 'children';

export type NavbarProps = Omit<JSX.HTMLAttributes<HTMLElement>, OwnedAttributes> & {
  class?: string;
  as?: NavbarElement;
  /** Left slot (`navbar-start`, half the width). */
  start?: ComponentChildren;
  /** Middle slot (`navbar-center`, its content width). */
  center?: ComponentChildren;
  /** Right slot (`navbar-end`, half the width, right-aligned). */
  end?: ComponentChildren;
};

const hasContent = (slot: ComponentChildren) => slot != null && typeof slot !== 'boolean' && slot !== '';

/**
 * daisyUI navbar. Only the slots given are rendered, except that `center` keeps both side wrappers: it is only centred
 * between two equal halves.
 */
const Navbar: FunctionComponent<NavbarProps> = ({ as: Root = 'header', start, center, end, class: className, ...rest }) => {
  const centred = hasContent(center);
  return (
    <Root {...rest} class={cx('navbar', className)}>
      {(centred || hasContent(start)) && <div class="navbar-start">{start}</div>}
      {centred && <div class="navbar-center">{center}</div>}
      {(centred || hasContent(end)) && <div class="navbar-end">{end}</div>}
    </Root>
  );
};

export default Navbar;
