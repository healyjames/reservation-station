import { render } from 'preact';
import { ManageApp } from './ManageApp';

const reservationId = new URLSearchParams(window.location.search).get('id');
const container = document.getElementById('manage-app');
if (container) {
  render(<ManageApp reservationId={reservationId} />, container);
}
