import type { FunctionComponent } from 'preact';
import styles from './AdminHeader.module.css';

interface AdminHeaderProps {
  venueName: string;
  onLogout: () => void;
}

const AdminHeader: FunctionComponent<AdminHeaderProps> = ({ venueName, onLogout }) => (
  <header class={styles.main_header}>
    <span id="venue-name" class={styles.header_brand}>{venueName}</span>
    <button class={styles.btn_logout} onClick={onLogout}>Sign out</button>
  </header>
);

export default AdminHeader;
