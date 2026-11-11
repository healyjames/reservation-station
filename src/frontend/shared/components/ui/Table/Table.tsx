import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

type OwnedAttributes = 'class' | 'className';

export type TableProps = Omit<JSX.HTMLAttributes<HTMLTableElement>, OwnedAttributes> & {
  /** Classes for the scroll wrapper, so `hidden md:block` hides the whole table. Other attributes go on the `<table>`. */
  class?: string;
  /** Names the table (`<caption>`). Leave it out only when the table is named with `aria-label`/`aria-labelledby`. */
  caption?: ComponentChildren;
  /** Keep the caption for assistive tech but hide it visually (a heading above already says it). */
  hideCaption?: boolean;
  /** The table's `thead`/`tbody` rows, written natively. */
  children: ComponentChildren;
};

/**
 * daisyUI table in a horizontal scroll container. Native table semantics: pass `<thead>`/`<tbody>` with `th scope`.
 * No zebra, size or pinned-row variants: the legacy admin tables use none.
 */
const Table: FunctionComponent<TableProps> = ({ caption, hideCaption = false, class: className, children, ...rest }) => (
  <div class={cx('overflow-x-auto', className)}>
    <table {...rest} class="table">
      {caption != null && caption !== false && caption !== '' && (
        <caption class={hideCaption ? 'sr-only' : 'pb-2 text-start font-semibold'}>{caption}</caption>
      )}
      {children}
    </table>
  </div>
);

export default Table;
