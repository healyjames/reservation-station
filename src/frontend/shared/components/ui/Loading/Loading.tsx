import type { FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

export type LoadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type OwnedAttributes =
  | 'size'
  | 'role'
  | 'class'
  | 'className'
  | 'children'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-hidden'
  | 'aria-live'
  | 'aria-atomic';

export type LoadingProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, OwnedAttributes> & {
  class?: string;
  size?: LoadingSize;
  /** Announced to assistive tech. `null` or `''` = decorative, for when visible text or a busy parent already says it. */
  label?: string | null;
};

const SIZE_CLASSES: Record<LoadingSize, string> = {
  xs: 'loading-xs',
  sm: 'loading-sm',
  md: '',
  lg: 'loading-lg',
  xl: 'loading-xl',
};

const Loading: FunctionComponent<LoadingProps> = ({ size = 'md', label = 'Loading', class: className, ...rest }) => {
  const indicatorClass = cx('loading', SIZE_CLASSES[size]);

  if (!label) {
    return <span {...rest} aria-hidden="true" class={cx(indicatorClass, className)} />;
  }

  // Live regions announce content changes, not names, so the label is (visually hidden) text content, not aria-label.
  // TypeScript never checks hyphenated JSX attributes, so owned ARIA attributes are also cleared at runtime.
  return (
    <span
      {...rest}
      role="status"
      aria-label={undefined}
      aria-labelledby={undefined}
      aria-hidden={undefined}
      aria-live={undefined}
      aria-atomic={undefined}
      class={cx(indicatorClass, className)}
    >
      <span class="sr-only">{label}</span>
    </span>
  );
};

export default Loading;
