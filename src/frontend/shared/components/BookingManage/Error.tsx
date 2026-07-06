import type { FunctionComponent } from 'preact';
import { StandaloneLayout, MessageCard } from '@shared/components';
import styles from './Error.module.css';

type ErrorProps = {
  message: string;
}

export const Error: FunctionComponent<ErrorProps> = ({ message }) => (
  <StandaloneLayout title="Manage your booking">
    <div class={styles.content}>
      <MessageCard variant="error" title="Unable to load booking">
        <p>{message}</p>
      </MessageCard>
    </div>
  </StandaloneLayout>
);
