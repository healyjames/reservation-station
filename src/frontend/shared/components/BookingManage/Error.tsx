import type { FunctionComponent } from 'preact';
import { StandaloneLayout, MessageCard } from '@shared/components';

interface ErrorProps {
  message: string;
}

export const Error: FunctionComponent<ErrorProps> = ({ message }) => (
  <StandaloneLayout title="Manage your booking">
    <MessageCard variant="error" title="Unable to load booking">
      <p>{message}</p>
    </MessageCard>
  </StandaloneLayout>
);
