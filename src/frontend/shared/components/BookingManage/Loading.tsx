import type { FunctionComponent } from 'preact';
import { StandaloneLayout } from '@shared/components';
import { Loading as UiLoading } from '@shared/components/ui';

export const Loading: FunctionComponent = () => (
  <StandaloneLayout title="Manage your booking">
    <div class="flex items-center gap-3">
      <UiLoading label="Loading your booking details" />
      <p class="m-0" aria-hidden="true">
        Loading your booking details...
      </p>
    </div>
  </StandaloneLayout>
);
