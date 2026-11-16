import { useRef } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import type { BookingFormData, TenantConfig } from '@shared/types';
import { Alert, Button, Fieldset, Input, Textarea } from '@shared/components/ui';
import { ArrowLeft } from '@shared/components/ui/icons';
import { isStandaloneMode } from '@shared/utils';
import { cx } from '@shared/utils/cx';

type Step2FormProps = {
  tenantConfig: TenantConfig;
  formData: BookingFormData;
  submitError: string;
  isSubmitting: boolean;
  onFieldChange: <K extends keyof BookingFormData>(field: K, value: BookingFormData[K]) => void;
  onSubmit: (form: HTMLFormElement) => void;
  onBack: () => void;
};

export const Step2Form: FunctionComponent<Step2FormProps> = ({ formData, submitError, isSubmitting, onFieldChange, onSubmit, onBack }) => {
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (formRef.current) onSubmit(formRef.current);
  }

  return (
    <div class={cx('p-6 motion-safe:animate-slide-in', isStandaloneMode() && 'mx-auto my-8 max-w-[520px]')}>
      <div class="mb-4 flex items-center justify-end gap-3">
        <div class="bg-base-200 text-accent rounded-field px-4 py-2 text-sm font-semibold">Step 2 of 2</div>
        <Button
          variant="ghost"
          shape="square"
          class="[--btn-bg:var(--color-base-200)] hover:[--btn-bg:var(--color-base-300)]"
          id="prev-step-btn"
          aria-label="Previous step"
          onClick={onBack}
        >
          <ArrowLeft />
        </Button>
      </div>

      <form id="booking-form-step2" class="grid gap-4" ref={formRef} onSubmit={handleSubmit}>
        <Fieldset label="First Name" required>
          <Input
            id="firstName"
            name="firstName"
            value={formData.firstName}
            maxLength={50}
            autocomplete="given-name"
            required
            validator
            onInput={(e) => onFieldChange('firstName', (e.target as HTMLInputElement).value)}
          />
        </Fieldset>

        <Fieldset label="Surname" required>
          <Input
            id="surname"
            name="surname"
            value={formData.surname}
            maxLength={50}
            autocomplete="family-name"
            required
            validator
            onInput={(e) => onFieldChange('surname', (e.target as HTMLInputElement).value)}
          />
        </Fieldset>

        <Fieldset label="Email" required>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            autocomplete="email"
            required
            validator
            onInput={(e) => onFieldChange('email', (e.target as HTMLInputElement).value)}
          />
        </Fieldset>

        <Fieldset label="Phone Number" required>
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
            validator
            onInput={(e) => onFieldChange('telephone', (e.target as HTMLInputElement).value)}
          />
        </Fieldset>

        <Fieldset label="Dietary Requirements & Special Requests (Optional)">
          <Textarea
            id="dietary"
            name="dietary"
            value={formData.dietary}
            maxLength={500}
            onInput={(e) => onFieldChange('dietary', (e.target as HTMLTextAreaElement).value)}
          />
        </Fieldset>

        {submitError && (
          <Alert variant="error" title="Error" headingLevel={null} live="assertive">
            <p>{submitError}</p>
          </Alert>
        )}

        <Button type="submit" variant="primary" block isLoading={isSubmitting}>
          {isSubmitting ? 'Booking...' : 'Book Now'}
        </Button>
      </form>
    </div>
  );
};
