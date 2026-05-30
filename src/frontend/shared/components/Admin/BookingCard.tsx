import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { Badge, Button } from '@shared/components';
import styles from './BookingCard.module.css';

interface BookingCardProps {
  reservation: Reservation;
  onEdit: (reservation: Reservation) => void;
  onDelete: (reservation: Reservation) => void;
}

const BookingCard: FunctionComponent<BookingCardProps> = ({ reservation: r, onEdit, onDelete }) => (
  <div class={styles.booking_card}>
    <div class={styles.card_time_guests}>
      <span class={styles.card_time}>{r.reservation_time}</span>
      <Badge variant="default">
        <strong>{r.guests}</strong> guest{r.guests !== 1 ? 's' : ''}
      </Badge>
    </div>
    <div class={styles.card_name}>{r.first_name} {r.surname}</div>
    {r.dietary_requirements && (
      <div class={styles.card_dietary}>{r.dietary_requirements}</div>
    )}
    <div class={styles.card_actions}>
      <Button
        variant="action-edit"
        size="sm"
        onClick={() => onEdit(r)}
        aria-label={`Edit booking for ${r.first_name} ${r.surname}`}
      >
        Edit
      </Button>
      <Button
        variant="action-delete"
        size="sm"
        onClick={() => onDelete(r)}
        aria-label={`Delete booking for ${r.first_name} ${r.surname}`}
      >
        Delete
      </Button>
    </div>
  </div>
);

export default BookingCard;
