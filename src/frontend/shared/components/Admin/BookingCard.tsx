import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { Badge, Card } from '@shared/components/ui';
import BookingActions from './BookingActions';

type BookingCardProps = {
  reservation: Reservation;
  onEdit: (reservation: Reservation) => void;
  onDelete: (reservation: Reservation) => void;
};

const BookingCard: FunctionComponent<BookingCardProps> = ({ reservation: r, onEdit, onDelete }) => (
  <Card class="bg-base-200 [--card-p:1rem]" data-booking-id={r.id}>
    <div class="flex items-center justify-between gap-3">
      <span class="text-lg font-semibold tabular-nums">{r.reservation_time}</span>
      <Badge>
        <strong>{r.guests}</strong>&nbsp;guest{r.guests !== 1 ? 's' : ''}
      </Badge>
    </div>
    <div class="text-base">
      {r.first_name} {r.surname}
    </div>
    {r.dietary_requirements && <div class="text-base-content/70">{r.dietary_requirements}</div>}
    <BookingActions reservation={r} onEdit={onEdit} onDelete={onDelete} />
  </Card>
);

export default BookingCard;
