import type { EmailTemplate, TenantReservationEmailData } from '../types';
import { formatEmailDate } from '../utils/formatEmailDate';
import { detailsTable, emailWrapper } from './helpers';

export function buildTenantConfirmationEmail(data: TenantReservationEmailData): EmailTemplate {
  const subject = `New booking: ${data.firstName} ${data.surname} — ${formatEmailDate(data.reservationDate)} at ${data.reservationTime}`;

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#333333;">A new booking has been received.</p>
    ${detailsTable([
      ['Customer Name', `${data.firstName} ${data.surname}`],
      ['Email', data.customerEmail],
      ['Phone', data.telephone],
      ['Date', formatEmailDate(data.reservationDate)],
      ['Time', data.reservationTime],
      ['Guests', String(data.guests)],
      ['Dietary Requirements & Special Requests', data.dietaryRequirements || 'None'],
      ['Booking ID', data.reservationId],
    ], 180)}`;

  return { subject, html: emailWrapper(data.tenantName, 'New Booking Received', body) };
}
