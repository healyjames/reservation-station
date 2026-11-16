import type { FunctionComponent } from 'preact';
import { List } from '@shared/components/ui';

type BookingDetail = {
  /** Also the row key, so labels must be unique. */
  label: string;
  value: string | number;
};

type BookingDetailsListProps = {
  details: BookingDetail[];
};

/** A booking's details as a boxed term-above-value list (ui/List, stacked). */
const BookingDetailsList: FunctionComponent<BookingDetailsListProps> = ({ details }) => (
  <List
    layout="stacked"
    items={details.map(({ label, value }) => ({ term: label, value }))}
    class="rounded-box border-base-300 bg-base-200 mb-6 border"
  />
);

export default BookingDetailsList;
