import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import styles from './AdminSidebar.module.css';

interface AdminSidebarProps {
  activePage: 'bookings' | 'settings';
  onGoBookings: () => void;
  onGoSettings: () => void;
}

const AdminSidebar: FunctionComponent<AdminSidebarProps> = ({ activePage, onGoBookings, onGoSettings }) => {
  const isOpen = useSignal(false);

  function toggle() {
    isOpen.value = !isOpen.value;
  }

  function close() {
    isOpen.value = false;
  }

  return (
    <>
      <button
        class={styles.hamburger}
        aria-label={isOpen.value ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isOpen.value}
        aria-controls="admin-sidebar-nav"
        onClick={toggle}
      >
        {isOpen.value ? '✕' : '☰'}
      </button>

      {isOpen.value && <div class={styles.overlay} onClick={close} aria-hidden="true" />}

      <nav id="admin-sidebar-nav" class={`${styles.sidebar_nav}${isOpen.value ? ` ${styles.open}` : ''}`} aria-label="Admin navigation">
        <div class={styles.sidebar_logo} aria-hidden="true" />
        <button
          class={`${styles.tab_btn}${activePage === 'bookings' ? ` ${styles.active}` : ''}`}
          aria-current={activePage === 'bookings' ? 'page' : undefined}
          onClick={activePage !== 'bookings' ? onGoBookings : undefined}
        >
          Bookings
        </button>
        <button
          class={`${styles.tab_btn}${activePage === 'settings' ? ` ${styles.active}` : ''}`}
          aria-current={activePage === 'settings' ? 'page' : undefined}
          onClick={activePage !== 'settings' ? onGoSettings : undefined}
        >
          Settings
        </button>
      </nav>
    </>
  );
};

export default AdminSidebar;
