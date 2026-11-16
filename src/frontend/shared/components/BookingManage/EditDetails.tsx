import { useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { TenantConfig } from '@shared/types';
import type { EditData } from '@shared/types';
import { StandaloneLayout } from '@shared/components';
import { Button, Fieldset, Input, Select, Textarea } from '@shared/components/ui';
import { ArrowLeft } from '@shared/components/ui/icons';
import { ErrorAlert } from './ErrorAlert';

type EditDetailsProps = {
  editData: Signal<EditData | null>;
  tenantConfig: Signal<TenantConfig | null>;
  errorMessage: Signal<string>;
  goToOverview: () => void;
  saveEditDetails: (data: EditData) => Promise<void>;
};

export const EditDetails: FunctionComponent<EditDetailsProps> = ({
  editData,
  tenantConfig,
  errorMessage,
  goToOverview,
  saveEditDetails,
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const isSaving = useSignal(false);
  const d = editData.value!;
  const maxGuests = tenantConfig.value?.max_guests ?? 20;
  const guestOptions = Array.from({ length: maxGuests - 1 }, (_, i) => ({
    value: i + 2,
    label: `${i + 2}`,
  }));

  const firstName = useSignal(d.first_name);
  const surname = useSignal(d.surname);
  const telephone = useSignal(d.telephone);
  const email = useSignal(d.email);
  const dietary = useSignal(d.dietary_requirements);
  const guests = useSignal(d.guests);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!formRef.current?.checkValidity()) {
      formRef.current?.reportValidity();
      return;
    }
    isSaving.value = true;
    await saveEditDetails({
      first_name: firstName.value.trim(),
      surname: surname.value.trim(),
      telephone: telephone.value.trim(),
      email: email.value.trim(),
      dietary_requirements: dietary.value.trim(),
      guests: guests.value,
    });
    isSaving.value = false;
  }

  return (
    <StandaloneLayout title="Edit Details">
      <p>Update your contact information and guest count.</p>
      <ErrorAlert message={errorMessage.value} />
      <form class="flex flex-col gap-4" ref={formRef} onSubmit={handleSubmit}>
        <Fieldset label="First Name" required>
          <Input
            id="edit-first-name"
            validator
            name="first_name"
            value={firstName.value}
            maxLength={50}
            autocomplete="given-name"
            required
            onInput={(e) => {
              firstName.value = (e.target as HTMLInputElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Surname" required>
          <Input
            id="edit-surname"
            validator
            name="surname"
            value={surname.value}
            maxLength={50}
            autocomplete="family-name"
            required
            onInput={(e) => {
              surname.value = (e.target as HTMLInputElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Phone Number" required>
          <Input
            id="edit-telephone"
            validator
            name="telephone"
            type="tel"
            value={telephone.value}
            autocomplete="tel"
            placeholder="+44 7700 900000"
            pattern="\+?[\d\s\-]{7,15}"
            title="Please enter a valid phone number (7–15 digits)"
            required
            onInput={(e) => {
              telephone.value = (e.target as HTMLInputElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Email" required>
          <Input
            id="edit-email"
            validator
            name="email"
            type="email"
            value={email.value}
            autocomplete="email"
            required
            onInput={(e) => {
              email.value = (e.target as HTMLInputElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Dietary Requirements & Special Requests (Optional)">
          <Textarea
            id="edit-dietary"
            name="dietary_requirements"
            value={dietary.value}
            maxLength={500}
            onInput={(e) => {
              dietary.value = (e.target as HTMLTextAreaElement).value;
            }}
          />
        </Fieldset>
        <Fieldset label="Number of Guests">
          <Select
            id="edit-guests"
            name="guests"
            value={guests.value}
            options={guestOptions}
            required
            onChange={(e) => {
              guests.value = parseInt((e.target as HTMLSelectElement).value, 10);
            }}
          />
        </Fieldset>
        <div class="grid gap-3 sm:grid-cols-2">
          <Button onClick={goToOverview}>
            <ArrowLeft />
            Back
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving.value}>
            {isSaving.value ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </StandaloneLayout>
  );
};
