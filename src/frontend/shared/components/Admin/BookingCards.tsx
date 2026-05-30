import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import BookingCard from './BookingCard';
import styles from './BookingCards.module.css';

interface BookingCardsProps {
  reservations: Reservation[];
  onEdit: (reservation: Reservation) => void;
  onDelete: (reservation: Reservation) => void;
}

const BookingCards: FunctionComponent<BookingCardsProps> = ({ reservations, onEdit, onDelete }) => (
  <div class={styles.booking_cards}>
    {reservations.map(r => (
      <BookingCard key={r.id} reservation={r} onEdit={onEdit} onDelete={onDelete} />
    ))}
  </div>
);

export default BookingCards;
