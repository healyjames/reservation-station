import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { Modal, Button } from '@shared/components';
import { adminFetch } from '@shared/utils/adminFetch';
import styles from './DeleteConfirmModal.module.css';

type DeleteConfirmModalProps = {
  reservation: Reservation;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}

const DeleteConfirmModal: FunctionComponent<DeleteConfirmModalProps> = ({ reservation, token, onSuccess, onClose }) => {
  const isDeleting = useSignal(false);
  const errorMessage = useSignal('');

  async function handleDelete() {
    errorMessage.value = '';
    isDeleting.value = true;
    try {
      const r = await adminFetch(`/api/admin/reservations/${reservation.id}`, token, { method: 'DELETE' });
      if (r.ok) {
        onSuccess();
        onClose();
        return;
      }
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      errorMessage.value = data.error ?? `Delete failed (${r.status})`;
    } catch {
      errorMessage.value = 'Unable to connect. Please try again.';
    } finally {
      isDeleting.value = false;
    }
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="danger" isLoading={isDeleting.value} onClick={handleDelete}>
        Delete booking
      </Button>
    </>
  );

  return (
    <Modal open onClose={onClose} title="Delete booking" footer={footer}>
      <p class={styles.confirm_text}>Are you sure you want to delete this booking? This action cannot be undone.</p>

      {errorMessage.value && (
        <div class={styles.alert_error} role="alert" aria-live="assertive">
          {errorMessage.value}
        </div>
      )}

      <dl class={styles.booking_details}>
        <div class={styles.detail_row}>
          <dt>Name</dt>
          <dd>
            {reservation.first_name} {reservation.surname}
          </dd>
        </div>
        <div class={styles.detail_row}>
          <dt>Date</dt>
          <dd>{reservation.reservation_date}</dd>
        </div>
        <div class={styles.detail_row}>
          <dt>Time</dt>
          <dd>{reservation.reservation_time}</dd>
        </div>
        <div class={styles.detail_row}>
          <dt>Guests</dt>
          <dd>{reservation.guests}</dd>
        </div>
        {reservation.dietary_requirements && (
          <div class={styles.detail_row}>
            <dt>Dietary requirements</dt>
            <dd>{reservation.dietary_requirements}</dd>
          </div>
        )}
        {reservation.telephone && (
          <div class={styles.detail_row}>
            <dt>Telephone</dt>
            <dd>{reservation.telephone}</dd>
          </div>
        )}
        {reservation.email && (
          <div class={styles.detail_row}>
            <dt>Email</dt>
            <dd>{reservation.email}</dd>
          </div>
        )}
      </dl>
    </Modal>
  );
};

export default DeleteConfirmModal;
