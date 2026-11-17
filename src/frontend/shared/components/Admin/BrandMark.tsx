import type { FunctionComponent, JSX } from 'preact';

type BrandMarkProps = Omit<JSX.SVGAttributes<SVGSVGElement>, 'viewBox' | 'xmlns' | 'aria-hidden' | 'fill'>;

/**
 * The sign-in logo: a filled circle with two bars. Decorative, and filled with the current text colour.
 * The path appears to be Google's Material Icons `pause_circle_filled` (Apache-2.0); it was inline in Login before.
 */
const BrandMark: FunctionComponent<BrandMarkProps> = (props) => (
  <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
  </svg>
);

export default BrandMark;
