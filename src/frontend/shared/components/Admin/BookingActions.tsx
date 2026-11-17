import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { Button } from '@shared/components/ui';
import { Pencil, Trash2 } from '@shared/components/ui/icons';

type BookingActionsProps = {
  reservation: Reservation;
  onEdit: (reservation: Reservation) => void;
  onDelete: (reservation: Reservation) => void;
};

/** Edit and Delete for one booking, named with the guest ("Edit booking for Alex Guest") so a list of them can be told apart. */
const BookingActions: FunctionComponent<BookingActionsProps> = ({ reservation: r, onEdit, onDelete }) => {
  const guest = `${r.first_name} ${r.surname}`;
  return (
    <div class="flex justify-end gap-1">
      <Button variant="ghost" size="sm" aria-label={`Edit booking for ${guest}`} onClick={() => onEdit(r)}>
        <Pencil />
        Edit
      </Button>
      <Button variant="ghost" size="sm" class="text-error" aria-label={`Delete booking for ${guest}`} onClick={() => onDelete(r)}>
        <Trash2 />
        Delete
      </Button>
    </div>
  );
};

export default BookingActions;
