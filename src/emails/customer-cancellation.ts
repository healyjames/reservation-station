import type { CustomerReservationEmailData, EmailTemplate } from '../types';
import { formatEmailDate } from '../utils/formatEmailDate';
import { detailsTable, emailWrapper } from './helpers';

export function buildCustomerCancellationEmail(data: CustomerReservationEmailData): EmailTemplate {
  const subject = `Your booking at ${data.tenantName} has been cancelled`;

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#333333;">Hi ${data.firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#333333;">Your booking has been cancelled.</p>
    ${detailsTable([
      ['Date', formatEmailDate(data.reservationDate)],
      ['Time', data.reservationTime],
      ['Guests', String(data.guests)],
      ['Notes', data.dietaryRequirements || 'None'],
    ])}
    <p style="margin:16px 0 0;font-size:15px;color:#333333;">We hope to see you again soon.</p>`;

  return { subject, html: emailWrapper(data.tenantName, 'Booking Cancelled', body) };
}
