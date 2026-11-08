// Icon artwork is adapted from Lucide v0.460.0 (ISC licence, see ./LICENSE).
import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

type OwnedAttributes =
  | 'size'
  | 'title'
  | 'name'
  | 'xmlns'
  | 'role'
  | 'class'
  | 'className'
  | 'children'
  | 'width'
  | 'height'
  | 'viewBox'
  | 'fill'
  | 'stroke'
  | 'stroke-width'
  | 'strokeWidth'
  | 'stroke-linecap'
  | 'strokeLinecap'
  | 'stroke-linejoin'
  | 'strokeLinejoin'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-hidden';

export type IconProps = Omit<JSX.SVGAttributes<SVGSVGElement>, OwnedAttributes> & {
  class?: string;
  /** Width and height in px. Defaults to `1em`, the surrounding text size. CSS (e.g. a `size-4` class) can override it. */
  size?: number;
  /**
   * Accessible name, for an icon that carries meaning on its own. Without it (or with `''`) the icon is decorative and
   * hidden from assistive tech. It shows no hover tooltip. Inside a button, leave it out and name the button instead.
   */
  title?: string;
};

type IconBaseProps = IconProps & {
  /** Kebab-case Lucide name, exposed as `data-icon`. */
  name: string;
  children: ComponentChildren;
};

const Icon: FunctionComponent<IconBaseProps> = ({ name, size, title, class: className, children, ...rest }) => (
  // TypeScript never checks hyphenated JSX attributes, so owned ARIA attributes are also cleared at runtime.
  <svg
    {...rest}
    xmlns="http://www.w3.org/2000/svg"
    width={size ?? '1em'}
    height={size ?? '1em'}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    data-icon={name}
    role={title ? 'img' : undefined}
    aria-label={title || undefined}
    aria-labelledby={undefined}
    aria-hidden={title ? undefined : 'true'}
    class={cx('shrink-0', className)}
  >
    {children}
  </svg>
);

export default Icon;
