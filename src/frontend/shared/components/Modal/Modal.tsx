import { useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { FunctionComponent, ComponentChildren } from 'preact';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  footer?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
}

const Modal: FunctionComponent<ModalProps> = ({ open, onClose, title, footer, children, class: className }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleDialogClick = (e: MouseEvent) => {
    if (e.target === dialogRef.current) onClose();
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      class={`${styles.dialog} ${className ?? ''}`}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={handleDialogClick}
    >
      <div class={styles.content}>
        {title && (
          <div class={styles.header}>
            <h2 class={styles.title}>{title}</h2>
            <button type="button" class={styles.closeBtn} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        )}
        <div class={styles.body}>{children}</div>
        {footer && <div class={styles.footer}>{footer}</div>}
      </div>
    </dialog>,
    document.body
  );
};

export default Modal;
