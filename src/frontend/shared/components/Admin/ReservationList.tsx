import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { Button } from '@shared/components';
import styles from './ReservationList.module.css';

type ReservationListProps = {
  reservations: Reservation[];
  onEdit: (reservation: Reservation) => void;
  onDelete: (reservation: Reservation) => void;
}

const ReservationList: FunctionComponent<ReservationListProps> = ({ reservations, onEdit, onDelete }) => (
  <table class={`${styles.admin_table} ${styles.booking_table}`}>
    <thead>
      <tr>
        <th scope="col">Time</th>
        <th scope="col">Name</th>
        <th scope="col">Guests</th>
        <th scope="col">Dietary requirements</th>
        <th scope="col">Actions</th>
      </tr>
    </thead>
    <tbody>
      {reservations.map((r) => (
        <tr key={r.id}>
          <td>{r.reservation_time}</td>
          <td>
            {r.first_name} {r.surname}
          </td>
          <td>{r.guests}</td>
          <td>{r.dietary_requirements || '–'}</td>
          <td class={styles.actions_cell}>
            <Button variant="action-edit" size="sm" onClick={() => onEdit(r)} aria-label={`Edit booking for ${r.first_name} ${r.surname}`}>
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
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default ReservationList;
