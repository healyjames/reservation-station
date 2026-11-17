import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import BookingCard from './BookingCard';

type BookingCardsProps = {
  reservations: Reservation[];
  onEdit: (reservation: Reservation) => void;
  onDelete: (reservation: Reservation) => void;
};

/** The day's bookings as cards, below md. From md up, ReservationList shows them as a table instead. */
const BookingCards: FunctionComponent<BookingCardsProps> = ({ reservations, onEdit, onDelete }) => (
  <div class="grid gap-3 md:hidden">
    {reservations.map((r) => (
      <BookingCard key={r.id} reservation={r} onEdit={onEdit} onDelete={onDelete} />
    ))}
  </div>
);

export default BookingCards;
