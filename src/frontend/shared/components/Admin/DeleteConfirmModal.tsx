import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { Alert, Button, List, Modal } from '@shared/components/ui';
import { adminFetch } from '@shared/utils/adminFetch';

type DeleteConfirmModalProps = {
  reservation: Reservation;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
};

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
      <Button variant="error" isLoading={isDeleting.value} onClick={handleDelete}>
        Delete booking
      </Button>
    </>
  );

  return (
    <Modal open onClose={onClose} title="Delete booking" footer={footer}>
      <p class="mt-0">Are you sure you want to delete this booking? This action cannot be undone.</p>

      {errorMessage.value && (
        <Alert variant="error" live="assertive" class="mb-4">
          {errorMessage.value}
        </Alert>
      )}

      <List
        class="rounded-box border-base-300 bg-base-200 border"
        items={[
          { term: 'Name', value: `${reservation.first_name} ${reservation.surname}` },
          { term: 'Date', value: reservation.reservation_date },
          { term: 'Time', value: reservation.reservation_time },
          { term: 'Guests', value: reservation.guests },
          reservation.dietary_requirements && { term: 'Dietary requirements & special requests', value: reservation.dietary_requirements },
          reservation.telephone && { term: 'Telephone', value: reservation.telephone },
          reservation.email && { term: 'Email', value: reservation.email },
        ]}
      />
    </Modal>
  );
};

export default DeleteConfirmModal;
