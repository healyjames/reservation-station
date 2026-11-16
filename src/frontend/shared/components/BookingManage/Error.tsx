import type { FunctionComponent } from 'preact';
import { StandaloneLayout } from '@shared/components';
import { Alert } from '@shared/components/ui';

type ErrorProps = {
  message: string;
};

export const Error: FunctionComponent<ErrorProps> = ({ message }) => (
  <StandaloneLayout title="Manage your booking">
    <div class="p-6 motion-safe:animate-slide-in">
      <Alert variant="error" title="Unable to load booking" headingLevel={2}>
        <p>{message}</p>
      </Alert>
    </div>
  </StandaloneLayout>
);
