import type { FunctionComponent } from 'preact';
import { StandaloneLayout, Spinner } from '@shared/components';

export const LoadingView: FunctionComponent = () => (
  <StandaloneLayout title="Manage your booking">
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:32px 0" aria-busy="true">
      <Spinner size="md" label="Loading your booking details" />
      <p>Loading your booking details...</p>
    </div>
  </StandaloneLayout>
);
