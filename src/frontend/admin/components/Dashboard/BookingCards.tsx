import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { Reservation } from '@shared/types';
import BookingCard from './BookingCard';

interface BookingCardsProps {
  reservations: Reservation[];
  onEdit: (reservation: Reservation) => void;
  onDelete: (reservation: Reservation) => void;
}

const BookingCards: FunctionComponent<BookingCardsProps> = ({ reservations, onEdit, onDelete }) => (
  <div class="booking-cards">
    {reservations.map(r => (
      <BookingCard key={r.id} reservation={r} onEdit={onEdit} onDelete={onDelete} />
    ))}
  </div>
);

export default BookingCards;
