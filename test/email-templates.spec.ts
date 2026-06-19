import { describe, it, expect } from 'vitest';
import { buildCustomerConfirmationEmail } from '../src/emails/customer-confirmation';
import { buildCustomerAmendmentEmail } from '../src/emails/customer-amendment';
import { buildCustomerCancellationEmail } from '../src/emails/customer-cancellation';
import { buildTenantConfirmationEmail } from '../src/emails/tenant-confirmation';
import { buildTenantAmendmentEmail } from '../src/emails/tenant-amendment';
import { buildTenantCancellationEmail } from '../src/emails/tenant-cancellation';

const customerData = {
  tenantName: 'The Red Cow',
  firstName: 'Jane',
  reservationDate: '2099-07-15',
  reservationTime: '19:00',
  guests: 4,
  dietaryRequirements: 'Gluten free' as string | null,
};

const tenantData = {
  tenantName: 'The Red Cow',
  reservationId: '00000000-0000-4000-8000-000000000010',
  firstName: 'Jane',
  surname: 'Doe',
  telephone: '07700900000',
  customerEmail: 'jane@example.com',
  reservationDate: '2099-07-15',
  reservationTime: '19:00',
  guests: 4,
  dietaryRequirements: 'Gluten free' as string | null,
};

describe('buildCustomerConfirmationEmail', () => {
  it('returns non-empty subject', () => {
    expect(buildCustomerConfirmationEmail(customerData).subject).toBeTruthy();
  });

  it('returns non-empty html', () => {
    expect(buildCustomerConfirmationEmail(customerData).html).toBeTruthy();
  });

  it('subject includes tenant name', () => {
    expect(buildCustomerConfirmationEmail(customerData).subject).toContain('The Red Cow');
  });

  it('html includes customer first name', () => {
    expect(buildCustomerConfirmationEmail(customerData).html).toContain('Jane');
  });

  it('html includes reservation date', () => {
    expect(buildCustomerConfirmationEmail(customerData).html).toContain('2099-07-15');
  });

  it('html includes reservation time', () => {
    expect(buildCustomerConfirmationEmail(customerData).html).toContain('19:00');
  });

  it('html does not contain raw null when dietary requirements is null', () => {
    const result = buildCustomerConfirmationEmail({ ...customerData, dietaryRequirements: null });
    expect(result.html).not.toContain('>null<');
    expect(result.html).not.toContain('null');
  });
});

describe('buildCustomerAmendmentEmail', () => {
  it('returns non-empty subject', () => {
    expect(buildCustomerAmendmentEmail(customerData).subject).toBeTruthy();
  });

  it('returns non-empty html', () => {
    expect(buildCustomerAmendmentEmail(customerData).html).toBeTruthy();
  });

  it('subject includes tenant name', () => {
    expect(buildCustomerAmendmentEmail(customerData).subject).toContain('The Red Cow');
  });

  it('html includes customer first name', () => {
    expect(buildCustomerAmendmentEmail(customerData).html).toContain('Jane');
  });

  it('html includes reservation date', () => {
    expect(buildCustomerAmendmentEmail(customerData).html).toContain('2099-07-15');
  });

  it('html includes reservation time', () => {
    expect(buildCustomerAmendmentEmail(customerData).html).toContain('19:00');
  });

  it('html does not contain raw null when dietary requirements is null', () => {
    const result = buildCustomerAmendmentEmail({ ...customerData, dietaryRequirements: null });
    expect(result.html).not.toContain('>null<');
    expect(result.html).not.toContain('null');
  });
});

describe('buildCustomerCancellationEmail', () => {
  it('returns non-empty subject', () => {
    expect(buildCustomerCancellationEmail(customerData).subject).toBeTruthy();
  });

  it('returns non-empty html', () => {
    expect(buildCustomerCancellationEmail(customerData).html).toBeTruthy();
  });

  it('subject includes tenant name', () => {
    expect(buildCustomerCancellationEmail(customerData).subject).toContain('The Red Cow');
  });

  it('html includes customer first name', () => {
    expect(buildCustomerCancellationEmail(customerData).html).toContain('Jane');
  });

  it('html includes reservation date', () => {
    expect(buildCustomerCancellationEmail(customerData).html).toContain('2099-07-15');
  });

  it('html includes reservation time', () => {
    expect(buildCustomerCancellationEmail(customerData).html).toContain('19:00');
  });

  it('html does not contain raw null when dietary requirements is null', () => {
    const result = buildCustomerCancellationEmail({ ...customerData, dietaryRequirements: null });
    expect(result.html).not.toContain('>null<');
    expect(result.html).not.toContain('null');
  });
});

describe('buildTenantConfirmationEmail', () => {
  it('returns non-empty subject', () => {
    expect(buildTenantConfirmationEmail(tenantData).subject).toBeTruthy();
  });

  it('returns non-empty html', () => {
    expect(buildTenantConfirmationEmail(tenantData).html).toBeTruthy();
  });

  it('subject includes tenant name', () => {
    expect(buildTenantConfirmationEmail(tenantData).subject).toContain('The Red Cow');
  });

  it('html includes customer first name', () => {
    expect(buildTenantConfirmationEmail(tenantData).html).toContain('Jane');
  });

  it('html includes reservation date', () => {
    expect(buildTenantConfirmationEmail(tenantData).html).toContain('2099-07-15');
  });

  it('html includes reservation time', () => {
    expect(buildTenantConfirmationEmail(tenantData).html).toContain('19:00');
  });
});

describe('buildTenantAmendmentEmail', () => {
  it('returns non-empty subject', () => {
    expect(buildTenantAmendmentEmail(tenantData).subject).toBeTruthy();
  });

  it('returns non-empty html', () => {
    expect(buildTenantAmendmentEmail(tenantData).html).toBeTruthy();
  });

  it('subject includes tenant name', () => {
    expect(buildTenantAmendmentEmail(tenantData).subject).toContain('The Red Cow');
  });

  it('html includes customer first name', () => {
    expect(buildTenantAmendmentEmail(tenantData).html).toContain('Jane');
  });

  it('html includes reservation date', () => {
    expect(buildTenantAmendmentEmail(tenantData).html).toContain('2099-07-15');
  });

  it('html includes reservation time', () => {
    expect(buildTenantAmendmentEmail(tenantData).html).toContain('19:00');
  });
});

describe('buildTenantCancellationEmail', () => {
  it('returns non-empty subject', () => {
    expect(buildTenantCancellationEmail(tenantData).subject).toBeTruthy();
  });

  it('returns non-empty html', () => {
    expect(buildTenantCancellationEmail(tenantData).html).toBeTruthy();
  });

  it('subject includes tenant name', () => {
    expect(buildTenantCancellationEmail(tenantData).subject).toContain('The Red Cow');
  });

  it('html includes customer first name', () => {
    expect(buildTenantCancellationEmail(tenantData).html).toContain('Jane');
  });

  it('html includes reservation date', () => {
    expect(buildTenantCancellationEmail(tenantData).html).toContain('2099-07-15');
  });

  it('html includes reservation time', () => {
    expect(buildTenantCancellationEmail(tenantData).html).toContain('19:00');
  });
});
