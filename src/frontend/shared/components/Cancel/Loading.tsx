import type { FunctionComponent } from 'preact';
import { StandaloneLayout } from '@shared/components';
import { Loading as UiLoading } from '@shared/components/ui';

export const Loading: FunctionComponent = () => (
  <StandaloneLayout title="Cancel your booking">
    <div class="flex flex-col items-center gap-4 py-8">
      <UiLoading label="Loading your booking details" />
      <p class="m-0" aria-hidden="true">
        Loading your booking details...
      </p>
    </div>
  </StandaloneLayout>
);
