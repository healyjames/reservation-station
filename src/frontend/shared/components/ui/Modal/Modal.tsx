import { createPortal } from 'preact/compat';
import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { cx } from '@shared/utils/cx';
import Button from '../Button';
import { X } from '../icons';
import { ModalPortalContext } from './portalTarget';

type OwnedAttributes =
  | 'class'
  | 'className'
  | 'children'
  | 'title'
  | 'open'
  | 'role'
  | 'onCancel'
  | 'onClose'
  | 'onClick'
  | 'onPointerDown'
  | 'aria-labelledby'
  | 'aria-label'
  | 'aria-modal';

export type ModalProps = Omit<JSX.HTMLAttributes<HTMLDialogElement>, OwnedAttributes> & {
  class?: string;
  open: boolean;
  /**
   * Called on the close button, Esc, a backdrop click, and when the browser closes the dialog itself (e.g. a repeated
   * Esc in Chrome cannot be cancelled). Set `open` to false in response.
   */
  onClose: () => void;
  /** Shown as the dialog heading (`h2`) and used as its accessible name. */
  title: ComponentChildren;
  /** Actions, shown in daisyUI's `modal-action` row. */
  footer?: ComponentChildren;
  children: ComponentChildren;
};

/**
 * Native `<dialog>` opened with `showModal()` (focus is trapped and moves into the dialog; the browser returns it on
 * close), rendered in a portal on `document.body`. daisyUI locks page scroll while a `.modal` is open. A bottom sheet on
 * small screens, centred from `sm`. The title and footer stay in view; only the body scrolls.
 */
const Modal: FunctionComponent<ModalProps> = ({ open, onClose, title, footer, class: className, children, ...rest }) => {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const titleId = useId();
  const openRef = useRef(open);
  openRef.current = open;
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    if (!dialog || !open) return;
    // jsdom (tests) and very old browsers have no showModal(); the open attribute still shows it.
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    return () => {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    };
  }, [dialog, open]);

  return createPortal(
    // TypeScript never checks hyphenated JSX attributes, so owned ARIA attributes are also cleared at runtime.
    <dialog
      {...rest}
      ref={setDialog}
      aria-labelledby={titleId}
      aria-label={undefined}
      aria-modal={undefined}
      // Esc: keep the dialog open until the parent closes it, so `open` stays the source of truth.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // The browser closed it anyway; tell the parent. Our own close() runs only once `open` is already false.
      onClose={() => {
        if (openRef.current) onClose();
      }}
      // A click on the dialog element itself (not the box) is a backdrop click. It must also start there, so a text
      // selection dragged out of a field does not close the modal.
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
      class={cx('modal modal-bottom sm:modal-middle', className)}
    >
      <div class="modal-box flex flex-col">
        <Button variant="ghost" size="sm" shape="circle" class="absolute end-2 top-2" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
        <h2 id={titleId} class="m-0 pe-8 text-lg font-bold">
          {title}
        </h2>
        <div class="mt-4 min-h-0 flex-1 overflow-y-auto">
          <ModalPortalContext.Provider value={dialog}>{children}</ModalPortalContext.Provider>
        </div>
        {footer && <div class="modal-action">{footer}</div>}
      </div>
    </dialog>,
    document.body,
  );
};

export default Modal;
