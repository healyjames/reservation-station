import { useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { TenantConfig } from '@shared/types';
import { StandaloneLayout, Input, Select, Textarea, FormField, Button, MessageCard } from '@shared/components';
import type { EditData } from '@shared/types';

interface EditDetailsProps {
  editData: Signal<EditData | null>;
  tenantConfig: Signal<TenantConfig | null>;
  errorMessage: Signal<string>;
  goToOverview: () => void;
  saveEditDetails: (data: EditData) => Promise<void>;
}

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
      {errorMessage.value && (
        <MessageCard variant="error" title="Something went wrong">
          <p>{errorMessage.value}</p>
        </MessageCard>
      )}
      <form ref={formRef} onSubmit={handleSubmit}>
        <FormField label="First Name" htmlFor="edit-first-name" required>
          <Input
            id="edit-first-name"
            name="first_name"
            type="text"
            value={firstName.value}
            maxLength={50}
            autocomplete="given-name"
            required
            onInput={(e) => { firstName.value = (e.target as HTMLInputElement).value; }}
          />
        </FormField>
        <FormField label="Surname" htmlFor="edit-surname" required>
          <Input
            id="edit-surname"
            name="surname"
            type="text"
            value={surname.value}
            maxLength={50}
            autocomplete="family-name"
            required
            onInput={(e) => { surname.value = (e.target as HTMLInputElement).value; }}
          />
        </FormField>
        <FormField label="Phone Number" htmlFor="edit-telephone" required>
          <Input
            id="edit-telephone"
            name="telephone"
            type="tel"
            value={telephone.value}
            autocomplete="tel"
            placeholder="+44 7700 900000"
            pattern="\+?[\d\s\-]{7,15}"
            title="Please enter a valid phone number (7–15 digits)"
            required
            onInput={(e) => { telephone.value = (e.target as HTMLInputElement).value; }}
          />
        </FormField>
        <FormField label="Email" htmlFor="edit-email" required>
          <Input
            id="edit-email"
            name="email"
            type="email"
            value={email.value}
            autocomplete="email"
            required
            onInput={(e) => { email.value = (e.target as HTMLInputElement).value; }}
          />
        </FormField>
        <FormField label="Dietary Requirements (Optional)" htmlFor="edit-dietary">
          <Textarea
            id="edit-dietary"
            name="dietary_requirements"
            value={dietary.value}
            rows={3}
            maxLength={500}
            placeholder="Let us know about any allergies or dietary preferences..."
            onInput={(e) => { dietary.value = (e.target as HTMLTextAreaElement).value; }}
          />
        </FormField>
        <FormField label="Number of Guests" htmlFor="edit-guests">
          <Select
            id="edit-guests"
            name="guests"
            value={guests.value}
            options={guestOptions}
            required
            onChange={(e) => { guests.value = parseInt((e.target as HTMLSelectElement).value, 10); }}
          />
        </FormField>
        <div class="action-group mt-2">
          <Button type="button" variant="secondary" onClick={goToOverview}>← Back</Button>
          <Button type="submit" variant="secondary" isLoading={isSaving.value}>
            {isSaving.value ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </StandaloneLayout>
  );
};
