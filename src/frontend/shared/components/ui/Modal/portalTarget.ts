import { createContext } from 'preact';

/**
 * The open ui/Modal's `<dialog>`, for content that portals (ui/FloatingTooltip). A modal dialog makes the rest of the
 * page inert and draws over it, so anything portalled to `document.body` would be hidden and unclickable.
 */
export const ModalPortalContext = createContext<HTMLElement | null>(null);
