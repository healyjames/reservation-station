import type { FunctionComponent } from 'preact';
import { Alert } from '@shared/components/ui';

type ErrorAlertProps = {
  message: string;
};

/** A failed manage-booking action: announced, with the page's "Something went wrong" title. Renders nothing without a message. */
export const ErrorAlert: FunctionComponent<ErrorAlertProps> = ({ message }) =>
  message ? (
    <Alert variant="error" title="Something went wrong" headingLevel={null} live="assertive">
      <p>{message}</p>
    </Alert>
  ) : null;
