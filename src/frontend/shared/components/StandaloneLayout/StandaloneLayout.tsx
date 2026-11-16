import type { FunctionComponent, ComponentChildren } from 'preact';
import { Card } from '@shared/components/ui';
import { cx } from '@shared/utils/cx';

type StandaloneLayoutProps = {
  title?: string;
  children: ComponentChildren;
  class?: string;
};

/** Full-page card for the manage and cancel pages: `main` > centred `section` card with an optional `h1`. */
const StandaloneLayout: FunctionComponent<StandaloneLayoutProps> = ({ title, children, class: className }) => (
  <main class="min-h-screen">
    <div class="flex min-h-screen items-center justify-center p-4 max-sm:min-h-0 max-sm:items-stretch">
      <Card
        as="section"
        // Card renders no heading for an empty title.
        title={title}
        titleAs="h1"
        // Legacy sizes: 1rem body text (daisyUI's card is 0.875rem), a large fluid title, 2rem padding (1.5rem on phones).
        class={cx(
          'bg-base-100 w-full max-w-[600px] [--card-fs:1rem] [--card-p:2rem] [--cardtitle-fs:clamp(1.75rem,4vw,2.25rem)] max-sm:[--card-p:1.5rem]',
          className,
        )}
      >
        <div class="grid gap-4">{children}</div>
      </Card>
    </div>
  </main>
);

export default StandaloneLayout;
