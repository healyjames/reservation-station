import { render } from 'preact';
import { BookingApp } from './BookingApp';

const container = document.getElementById('booking-app');
if (container) {
  render(<BookingApp />, container);
}
