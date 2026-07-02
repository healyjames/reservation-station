import { useRef } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import type { TenantConfig } from '@shared/types';
import { Input, Textarea, FormField, Button, MessageCard } from '@shared/components';
import type { BookingFormData } from '@shared/types';
import { isStandaloneMode } from '@shared/utils';
import styles from './Step2Form.module.css';

interface Step2FormProps {
  tenantConfig: TenantConfig;
  formData: BookingFormData;
  submitError: string;
  isSubmitting: boolean;
  onFieldChange: <K extends keyof BookingFormData>(field: K, value: BookingFormData[K]) => void;
  onSubmit: (form: HTMLFormElement) => void;
  onBack: () => void;
}

export const Step2Form: FunctionComponent<Step2FormProps> = ({ formData, submitError, isSubmitting, onFieldChange, onSubmit, onBack }) => {
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (formRef.current) onSubmit(formRef.current);
  }

  return (
    <div class={styles.content} style={isStandaloneMode() ? 'max-width:520px;margin:2rem auto' : undefined}>
      <div class={styles.nav}>
        <div class={styles.stepIndicator}>Step 2 of 2</div>
        <button type="button" class={styles.backBtn} id="prev-step-btn" aria-label="Previous step" onClick={onBack}>
          &#8592;
        </button>
      </div>

      <form id="booking-form-step2" class={styles.form} ref={formRef} onSubmit={handleSubmit}>
        <FormField label="First Name" htmlFor="firstName" required>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            value={formData.firstName}
            maxLength={50}
            autocomplete="given-name"
            required
            onInput={(e) => onFieldChange('firstName', (e.target as HTMLInputElement).value)}
          />
        </FormField>

        <FormField label="Surname" htmlFor="surname" required>
          <Input
            id="surname"
            name="surname"
            type="text"
            value={formData.surname}
            maxLength={50}
            autocomplete="family-name"
            required
            onInput={(e) => onFieldChange('surname', (e.target as HTMLInputElement).value)}
          />
        </FormField>

        <FormField label="Email" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            autocomplete="email"
            required
            onInput={(e) => onFieldChange('email', (e.target as HTMLInputElement).value)}
          />
        </FormField>

        <FormField label="Phone Number" htmlFor="telephone" required>
          <Input
            id="telephone"
            name="telephone"
            type="tel"
            value={formData.telephone}
            autocomplete="tel"
            placeholder="+44 7700 900000"
            pattern="\+?[\d\s\-]{7,15}"
            title="Please enter a valid phone number (7–15 digits, e.g. +44 7700 900000)"
            required
            onInput={(e) => onFieldChange('telephone', (e.target as HTMLInputElement).value)}
          />
        </FormField>

        <FormField label="Dietary Requirements & Special Requests (Optional)" htmlFor="dietary">
          <Textarea
            id="dietary"
            name="dietary"
            value={formData.dietary}
            rows={3}
            maxLength={500}
            onInput={(e) => onFieldChange('dietary', (e.target as HTMLTextAreaElement).value)}
          />
        </FormField>

        {submitError && (
          <MessageCard variant="error" title="Error">
            <p>{submitError}</p>
          </MessageCard>
        )}

        <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
          {isSubmitting ? 'Booking...' : 'Book Now'}
        </Button>
      </form>
    </div>
  );
};
