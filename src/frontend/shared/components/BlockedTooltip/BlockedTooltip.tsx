import { createPortal } from 'preact/compat';
import type { FunctionComponent } from 'preact';
import styles from './BlockedTooltip.module.css';

interface BlockedTooltipProps {
  visible: boolean;
  message: string;
  anchorRect: DOMRect | null;
  onClose: () => void;
  class?: string;
}

const BlockedTooltip: FunctionComponent<BlockedTooltipProps> = ({ visible, message, anchorRect, onClose, class: className }) => {
  if (!visible || !anchorRect) return null;

  const style = {
    position: 'fixed' as const,
    top: `${anchorRect.top - 8}px`,
    left: `${anchorRect.left + anchorRect.width / 2}px`,
    transform: 'translate(-50%, -100%)',
    zIndex: 1000,
  };

  return createPortal(
    <div class={`${styles.tooltip} ${className ?? ''}`} style={style} role="tooltip">
      <div class={styles.content}>
        <span class={styles.message}>{message}</span>
        <button type="button" class={styles.closeBtn} onClick={onClose} aria-label="Close tooltip">
          ✕
        </button>
      </div>
      <div class={styles.arrow} />
    </div>,
    document.body,
  );
};

export default BlockedTooltip;
