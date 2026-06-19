import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Reservation } from '@shared/types';
import { Modal, Button, FormField, Input, Textarea } from '@shared/components';
import { adminFetch } from '@shared/utils/adminFetch';
import styles from './BookingModal.module.css';

interface BookingModalProps {
  mode: 'create' | 'edit';
  reservation?: Reservation;
  defaultDate?: string;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}

const BookingModal: FunctionComponent<BookingModalProps> = ({ mode, reservation, defaultDate, token, onSuccess, onClose }) => {
  const firstName = useSignal(reservation?.first_name ?? '');
  const surname = useSignal(reservation?.surname ?? '');
  const telephone = useSignal(reservation?.telephone ?? '');
  const email = useSignal(reservation?.email ?? '');
  const reservationDate = useSignal(reservation?.reservation_date ?? defaultDate ?? '');
  const reservationTime = useSignal(reservation?.reservation_time ?? '');
  const guests = useSignal<number>(reservation?.guests ?? 2);
  const dietary = useSignal(reservation?.dietary_requirements ?? '');
  const errorMessage = useSignal('');
  const isSubmitting = useSignal(false);
  const isDeleting = useSignal(false);

  const title = mode === 'edit' ? 'Edit Booking' : 'New Booking';

  async function handleSubmit(e: Event) {
    e.preventDefault();
    errorMessage.value = '';
    isSubmitting.value = true;
    const body = {
      first_name: firstName.value,
      surname: surname.value,
      telephone: telephone.value,
      email: email.value,
      reservation_date: reservationDate.value,
      reservation_time: reservationTime.value,
      guests: Number(guests.value),
      dietary_requirements: dietary.value,
    };
    try {
      let r: Response;
      if (mode === 'edit' && reservation) {
        r = await adminFetch(`/api/admin/reservations/${reservation.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        r = await adminFetch('/api/admin/reservations', token, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      if (r.ok) {
        onSuccess();
        onClose();
        return;
      }
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      errorMessage.value = data.error ?? `Request failed (${r.status})`;
    } catch {
      errorMessage.value = 'Unable to connect. Please try again.';
    } finally {
      isSubmitting.value = false;
    }
  }

  async function handleDelete() {
    if (!reservation) return;
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
    <Button variant="primary" type="submit" form="booking-modal-form" isLoading={isSubmitting.value}>
      {mode === 'edit' ? 'Save changes' : 'Create booking'}
    </Button>
  );

  return (
    <Modal open onClose={onClose} title={title} footer={footer}>
      {errorMessage.value && (
        <div class={`${styles.alert} ${styles.alert_error}`} role="alert" aria-live="assertive">
          {errorMessage.value}
        </div>
      )}
      <form id="booking-modal-form" noValidate onSubmit={handleSubmit}>
        <div class={styles.form_row}>
          <FormField label="First name" htmlFor="bm-first-name" required>
            <Input
              id="bm-first-name"
              name="first_name"
              value={firstName.value}
              required
              autocomplete="off"
              onInput={(e) => {
                firstName.value = (e.target as HTMLInputElement).value;
              }}
            />
          </FormField>
          <FormField label="Surname" htmlFor="bm-surname" required>
            <Input
              id="bm-surname"
              name="surname"
              value={surname.value}
              required
              autocomplete="off"
              onInput={(e) => {
                surname.value = (e.target as HTMLInputElement).value;
              }}
            />
          </FormField>
        </div>
        <div class={styles.form_row}>
          <FormField label="Telephone" htmlFor="bm-telephone">
            <Input
              id="bm-telephone"
              type="tel"
              name="telephone"
              value={telephone.value}
              autocomplete="off"
              onInput={(e) => {
                telephone.value = (e.target as HTMLInputElement).value;
              }}
            />
          </FormField>
          <FormField label="Email" htmlFor="bm-email">
            <Input
              id="bm-email"
              type="email"
              name="email"
              value={email.value}
              autocomplete="off"
              onInput={(e) => {
                email.value = (e.target as HTMLInputElement).value;
              }}
            />
          </FormField>
        </div>
        <div class={styles.form_row}>
          <FormField label="Date" htmlFor="bm-date" required>
            <Input
              id="bm-date"
              type="date"
              name="reservation_date"
              value={reservationDate.value}
              required
              onChange={(e) => {
                reservationDate.value = (e.target as HTMLInputElement).value;
              }}
            />
          </FormField>
          <FormField label="Time" htmlFor="bm-time" required>
            <Input
              id="bm-time"
              type="time"
              name="reservation_time"
              value={reservationTime.value}
              required
              onChange={(e) => {
                reservationTime.value = (e.target as HTMLInputElement).value;
              }}
            />
          </FormField>
        </div>
        <div class={styles.fields}>
          <FormField label="Guests" htmlFor="bm-guests" required>
            <Input
              id="bm-guests"
              type="number"
              name="guests"
              value={guests.value}
              required
              onChange={(e) => {
                guests.value = parseInt((e.target as HTMLInputElement).value, 10) || 1;
              }}
            />
          </FormField>
          <FormField label="Dietary requirements" htmlFor="bm-dietary">
            <Textarea
              id="bm-dietary"
              name="dietary_requirements"
              value={dietary.value}
              rows={2}
              onInput={(e) => {
                dietary.value = (e.target as HTMLTextAreaElement).value;
              }}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
};

export default BookingModal;
