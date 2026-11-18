import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

/** `inline` = term beside value (aligned term column); `stacked` = term above value. */
export type ListLayout = 'inline' | 'stacked';

export type ListItem = {
  /** Also the row key, so terms must be unique within a list. */
  term: string;
  value: ComponentChildren;
};

export type ListRow = {
  /** The row key, unique within the list. */
  key: string;
  /** The row's text, in the flexible column. Several parts (e.g. date, kind, times) wrap with a gap between them. */
  content: ComponentChildren;
  /** Controls at the end of the row, e.g. a Remove button named after the row. */
  action?: ComponentChildren;
};

type Falsy = false | '' | null | undefined;

type OwnedAttributes = 'class' | 'className' | 'children';

type DescriptionListProps = Omit<JSX.HTMLAttributes<HTMLDListElement>, OwnedAttributes> & {
  class?: string;
  /** Falsy entries are skipped, so optional rows can be written inline: `r.telephone && { term, value }`. */
  items: ReadonlyArray<ListItem | Falsy>;
  layout?: ListLayout;
  rows?: never;
};

type RowListProps = Omit<JSX.HTMLAttributes<HTMLUListElement>, OwnedAttributes | 'role'> & {
  class?: string;
  /** One `<li>` per row. Falsy entries are skipped. Name the list with `aria-label` when the page has several. */
  rows: ReadonlyArray<ListRow | Falsy>;
  items?: never;
  layout?: never;
};

/** `items` renders term/value pairs as a `<dl>`; `rows` renders a `<ul>` of rows, each with an optional trailing action. */
export type ListProps = DescriptionListProps | RowListProps;

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

const isPresent = <T,>(entry: T | Falsy): entry is T => Boolean(entry);

/** daisyUI list: a description list (`items`) or a list of rows (`rows`), one `list-row` each. */
const List: FunctionComponent<ListProps> = (props) => {
  if (props.rows !== undefined) {
    const { rows, class: className, items: _items, layout: _layout, ...rest } = props;
    // base.css restores browser margins and indent on ul; spacing around the list is the consumer's. The rows are grid,
    // not list-item, so they have no markers and Safari would drop the list role; it is set explicitly.
    return (
      <ul {...rest} role="list" class={cx('list m-0 p-0', className)}>
        {rows.filter(isPresent).map(({ key, content, action }) => (
          <li key={key} class="list-row items-center gap-3 [--list-grid-cols:minmax(0,1fr)_auto]">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">{content}</div>
            {action && <div class="flex gap-2">{action}</div>}
          </li>
        ))}
      </ul>
    );
  }

  const { items, layout = 'inline', class: className, rows: _rows, ...rest } = props;
  return (
    // base.css restores browser margins on dl/dd; spacing around the list is the consumer's.
    <dl {...rest} class={cx('list m-0', className)}>
      {items.filter(isPresent).map(({ term, value }) => (
        <div key={term} class={cx('list-row', ROW_CLASSES[layout])}>
          <dt class="font-medium text-base-content/70">{term}</dt>
          <dd class={cx('m-0 text-base-content', VALUE_CLASSES[layout])}>{value}</dd>
        </div>
      ))}
    </dl>
  );
};

export default List;
