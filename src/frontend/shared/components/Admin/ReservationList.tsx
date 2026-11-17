import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { Table } from '@shared/components/ui';
import BookingActions from './BookingActions';

type ReservationListProps = {
  reservations: Reservation[];
  onEdit: (reservation: Reservation) => void;
  onDelete: (reservation: Reservation) => void;
};

/** The day's bookings as a table, from md up. Below md, BookingCards shows them instead. */
const ReservationList: FunctionComponent<ReservationListProps> = ({ reservations, onEdit, onDelete }) => (
  <Table class="hidden md:block" caption="Bookings for this day" hideCaption>
    <thead>
      <tr>
        <th scope="col">Time</th>
        <th scope="col">Name</th>
        <th scope="col">Guests</th>
        <th scope="col">Notes</th>
        <th scope="col" class="text-end">
          Actions
        </th>
      </tr>
    </thead>
    <tbody>
      {reservations.map((r) => (
        <tr key={r.id}>
          <td class="tabular-nums">{r.reservation_time}</td>
          <td>
            {r.first_name} {r.surname}
          </td>
          <td>{r.guests}</td>
          <td>{r.dietary_requirements || '–'}</td>
          <td>
            <BookingActions reservation={r} onEdit={onEdit} onDelete={onDelete} />
          </td>
        </tr>
      ))}
    </tbody>
  </Table>
);

export default ReservationList;
