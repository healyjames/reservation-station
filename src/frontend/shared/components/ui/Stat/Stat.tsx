import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

type OwnedAttributes = 'class' | 'className' | 'title' | 'children';

export type StatProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, OwnedAttributes> & {
  /** Classes for the `stats` root; other attributes (e.g. `id`) go there too. */
  class?: string;
  /** What is counted, e.g. "Covers". The stat title, not the HTML attribute. */
  title: ComponentChildren;
  value: ComponentChildren;
  /** Secondary line under the value. */
  desc?: ComponentChildren;
};

/**
 * One daisyUI stat in its `stats` box. Read in order: title, value, description. No multi-stat group: the only screen
 * shows one figure (DateNav covers).
 */
const Stat: FunctionComponent<StatProps> = ({ title, value, desc, class: className, ...rest }) => (
  <div {...rest} class={cx('stats', className)}>
    <div class="stat">
      <div class="stat-title">{title}</div>
      <div class="stat-value">{value}</div>
      {desc != null && desc !== false && desc !== '' && <div class="stat-desc">{desc}</div>}
    </div>
  </div>
);

export default Stat;
