import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { Badge, Button } from '@shared/components';

interface BookingCardProps {
  reservation: Reservation;
  onEdit: (reservation: Reservation) => void;
  onDelete: (reservation: Reservation) => void;
}

const BookingCard: FunctionComponent<BookingCardProps> = ({ reservation: r, onEdit, onDelete }) => (
  <div class="booking-card">
    <div class="card-time-guests">
      <span class="card-time">{r.reservation_time}</span>
      <Badge variant="default">
        <strong>{r.guests}</strong> guest{r.guests !== 1 ? 's' : ''}
      </Badge>
    </div>
    <div class="card-name">{r.first_name} {r.surname}</div>
    {r.dietary_requirements && (
      <div class="card-dietary">{r.dietary_requirements}</div>
    )}
    <div class="card-actions">
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
