import type { FunctionComponent } from 'preact';
import { StandaloneLayout, Spinner } from '@shared/components';
import styles from './LoadingView.module.css';

export const LoadingView: FunctionComponent = () => (
  <StandaloneLayout title="Cancel your booking">
    <div class={styles.loading} aria-busy="true">
      <Spinner size="md" label="Loading your booking details" />
      <p>Loading your booking details...</p>
    </div>
  </StandaloneLayout>
);
