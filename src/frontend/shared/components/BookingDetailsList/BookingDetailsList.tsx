import type { FunctionComponent } from 'preact';
import styles from './BookingDetailsList.module.css';

interface BookingDetail {
  label: string;
  value: string | number;
}

interface BookingDetailsListProps {
  details: BookingDetail[];
}

const BookingDetailsList: FunctionComponent<BookingDetailsListProps> = ({ details }) => (
  <dl class={styles.list}>
    {details.map(({ label, value }) => (
      <div key={label} class={styles.row}>
        <dt class={styles.term}>{label}</dt>
        <dd class={styles.value}>{value}</dd>
      </div>
    ))}
  </dl>
);

export default BookingDetailsList;
