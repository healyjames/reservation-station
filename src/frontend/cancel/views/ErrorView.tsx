import type { FunctionComponent } from 'preact';
import { StandaloneLayout, MessageCard } from '@shared/components';

interface ErrorViewProps {
  message: string;
}

export const ErrorView: FunctionComponent<ErrorViewProps> = ({ message }) => (
  <StandaloneLayout title="Cancel your booking">
    <MessageCard variant="error" title="Unable to cancel booking">
      <p>{message}</p>
    </MessageCard>
  </StandaloneLayout>
);
