// No CSS module — uses global .details-list / .detail-row tokens from shared.css
import type { FunctionComponent } from 'preact';

interface BookingDetail {
  label: string;
  value: string | number;
}

interface BookingDetailsListProps {
  details: BookingDetail[];
}

const BookingDetailsList: FunctionComponent<BookingDetailsListProps> = ({ details }) => (
  <dl class="details-list">
    {details.map(({ label, value }) => (
      <div key={label} class="detail-row">
        <dt class="detail-term">{label}</dt>
        <dd class="detail-value">{value}</dd>
      </div>
    ))}
  </dl>
);

export default BookingDetailsList;
