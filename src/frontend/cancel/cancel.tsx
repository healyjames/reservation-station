import { render } from 'preact';
import { CancelApp } from './CancelApp';

const reservationId = new URLSearchParams(window.location.search).get('id');
const container = document.getElementById('cancel-app');

if (container) {
  render(<CancelApp reservationId={reservationId} />, container);
}
