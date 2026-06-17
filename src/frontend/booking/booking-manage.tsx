import { render } from 'preact';
import { BookingManageApp } from './BookingManageApp';

const params = new URLSearchParams(window.location.search);
const reservationId = params.get('id');
const bookingEmail = params.get('email');
const bookingToken = params.get('token');
const container = document.getElementById('manage-app');
if (container) {
  render(<BookingManageApp reservationId={reservationId} bookingEmail={bookingEmail} bookingToken={bookingToken} />, container);
}
