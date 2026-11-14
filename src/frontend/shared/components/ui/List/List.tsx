import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

/** `inline` = term beside value (aligned term column); `stacked` = term above value. */
export type ListLayout = 'inline' | 'stacked';

export type ListItem = {
  /** Also the row key, so terms must be unique within a list. */
  term: string;
  value: ComponentChildren;
};

type OwnedAttributes = 'class' | 'className' | 'children';

export type ListProps = Omit<JSX.HTMLAttributes<HTMLDListElement>, OwnedAttributes> & {
  class?: string;
  /** Falsy entries are skipped, so optional rows can be written inline: `r.telephone && { term, value }`. */
  items: ReadonlyArray<ListItem | false | '' | null | undefined>;
  layout?: ListLayout;
};

// daisyUI sizes the first column per row (`minmax(0, auto)`), so terms would not line up; inline fixes it at up to
// 10rem (the legacy DeleteConfirmModal width). Stacked uses one column and moves the value to row 2 (`list-col-wrap`).
const ROW_CLASSES: Record<ListLayout, string> = {
  inline: '[--list-grid-cols:minmax(0,10rem)_1fr] gap-2',
  stacked: '[--list-grid-cols:1fr] gap-1',
};

const VALUE_CLASSES: Record<ListLayout, string> = {
  inline: '',
  stacked: 'list-col-wrap',
};

/** daisyUI list as a description list: one `list-row` per term/value pair. */
const List: FunctionComponent<ListProps> = ({ items, layout = 'inline', class: className, ...rest }) => (
  // app.css restores browser margins on dl/dd; spacing around the list is the consumer's.
  <dl {...rest} class={cx('list m-0', className)}>
    {items
      .filter((item): item is ListItem => Boolean(item))
      .map(({ term, value }) => (
        <div key={term} class={cx('list-row', ROW_CLASSES[layout])}>
          <dt class="font-medium text-base-content/70">{term}</dt>
          <dd class={cx('m-0 text-base-content', VALUE_CLASSES[layout])}>{value}</dd>
        </div>
      ))}
  </dl>
);

export default List;
