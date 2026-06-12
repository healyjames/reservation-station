import { render } from 'preact';
import { CancelApp } from './CancelApp';

const params = new URLSearchParams(window.location.search);
const reservationId = params.get('id');
const bookingEmail = params.get('email');
const container = document.getElementById('cancel-app');

if (container) {
  render(<CancelApp reservationId={reservationId} bookingEmail={bookingEmail} />, container);
}
