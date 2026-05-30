import { render } from 'preact';
import { BookingManageApp } from './BookingManageApp';

const reservationId = new URLSearchParams(window.location.search).get('id');
const container = document.getElementById('manage-app');
if (container) {
  render(<BookingManageApp reservationId={reservationId} />, container);
}
