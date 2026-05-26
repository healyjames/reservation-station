import { render } from 'preact';
import { AdminApp } from './AdminApp';

const container = document.getElementById('admin-app');
if (container) {
  render(<AdminApp />, container);
}
