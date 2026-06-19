import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Reservation } from '@shared/types';

type CancelView = 'loading' | 'error' | 'overview' | 'success';

interface UseCancelBookingReturn {
  view: Signal<CancelView>;
  reservation: Signal<Reservation | null>;
  errorMessage: Signal<string>;
  inlineError: Signal<string>;
  isCancelling: Signal<boolean>;
  handleCancel: () => Promise<void>;
}

export function useCancelBooking(
  reservationId: string | null,
  bookingEmail: string | null,
  bookingToken: string | null,
): UseCancelBookingReturn {
  const view = useSignal<CancelView>('loading');
  const reservation = useSignal<Reservation | null>(null);
  const errorMessage = useSignal('');
  const inlineError = useSignal('');
  const isCancelling = useSignal(false);

  useEffect(() => {
    if (!reservationId || !bookingEmail) {
      errorMessage.value = 'No booking reference found. Please check your cancellation link.';
      view.value = 'error';
      return;
    }

    loadReservation(reservationId, bookingEmail);
  }, [reservationId, bookingEmail]);

  async function loadReservation(id: string, email: string) {
    view.value = 'loading';
    try {
      const tokenParam = bookingToken ? `&token=${encodeURIComponent(bookingToken)}` : '';
      const response = await fetch(`/api/reservations/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}${tokenParam}`);
      if (response.status === 404) {
        errorMessage.value = 'Booking not found. It may have already been cancelled.';
        view.value = 'error';
        return;
      }
      if (!response.ok) {
        errorMessage.value = 'We could not load your booking right now. Please try again later.';
        view.value = 'error';
        return;
      }
      reservation.value = (await response.json()) as Reservation;
      inlineError.value = '';
      view.value = 'overview';
    } catch {
      errorMessage.value = 'We could not load your booking right now. Please try again later.';
      view.value = 'error';
    }
  }

  async function handleCancel() {
    if (isCancelling.value || !reservation.value?.id || !bookingEmail) return;
    isCancelling.value = true;
    inlineError.value = '';

    try {
      const tokenParam = bookingToken ? `&token=${encodeURIComponent(bookingToken)}` : '';
      const response = await fetch(
        `/api/reservations/${encodeURIComponent(reservation.value.id)}?email=${encodeURIComponent(bookingEmail)}${tokenParam}`,
        { method: 'DELETE' },
      );
      if (response.ok) {
        view.value = 'success';
        return;
      }
      inlineError.value =
        response.status === 404
          ? 'Booking not found. It may have already been cancelled.'
          : 'We could not cancel your booking right now. Please try again later.';
    } catch {
      inlineError.value = 'We could not cancel your booking right now. Please try again later.';
    } finally {
      isCancelling.value = false;
    }
  }

  return { view, reservation, errorMessage, inlineError, isCancelling, handleCancel };
}
