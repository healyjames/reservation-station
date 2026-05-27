import type { FunctionComponent } from 'preact';
import { StandaloneLayout, Spinner } from '@shared/components';
import styles from './Loading.module.css';

export const Loading: FunctionComponent = () => (
  <StandaloneLayout title="Manage your booking">
    <div class={styles.loading} aria-busy="true">
      <Spinner size="md" label="Loading your booking details" />
      <p>Loading your booking details...</p>
    </div>
  </StandaloneLayout>
);
