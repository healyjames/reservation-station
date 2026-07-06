import type { EmailTemplate, TenantReservationEmailData } from '../types';
import { formatEmailDate } from '../utils/formatEmailDate';
import { detailsTable, emailWrapper } from './helpers';

export function buildTenantCancellationEmail(data: TenantReservationEmailData): EmailTemplate {
  const subject = `Booking cancelled: ${data.firstName} ${data.surname} — ${formatEmailDate(data.reservationDate)} at ${data.reservationTime}`;

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#333333;">A booking has been cancelled.</p>
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

  return { subject, html: emailWrapper(data.tenantName, 'Booking Cancelled', body) };
}
