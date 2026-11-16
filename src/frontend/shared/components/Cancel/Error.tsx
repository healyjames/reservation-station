import type { FunctionComponent } from 'preact';
import { StandaloneLayout } from '@shared/components';
import { Alert } from '@shared/components/ui';

type ErrorProps = {
  message: string;
};

export const Error: FunctionComponent<ErrorProps> = ({ message }) => (
  <StandaloneLayout title="Cancel your booking">
    <Alert variant="error" title="Unable to cancel booking" headingLevel={2}>
      <p>{message}</p>
    </Alert>
  </StandaloneLayout>
);
