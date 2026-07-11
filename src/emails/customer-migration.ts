import type { CustomerReservationEmailData, EmailTemplate } from '../types';
import { formatEmailDate } from '../utils/formatEmailDate';
import { detailsTable, emailWrapper } from './helpers';

export function buildCustomerMigrationEmail(data: CustomerReservationEmailData): EmailTemplate {
  const subject = `Your booking at ${data.tenantName} has moved to a new system`;

  const manageLink =
    data.baseUrl && data.reservationId && data.customerEmail
      ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse;">
      <tr>
        <td>
          <a href="${data.baseUrl}/booking/?id=${data.reservationId}&email=${encodeURIComponent(data.customerEmail)}${data.manageToken ? `&token=${data.manageToken}` : ''}"
             style="display:inline-block;padding:10px 20px;background-color:#266663;color:#ffffff;text-decoration:none;font-size:14px;border-radius:4px;">
            Manage my booking
          </a>
        </td>
      </tr>
    </table>`
      : '';

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#333333;">Hi ${data.firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#333333;">${data.tenantName} has moved to a new online booking system. <strong>There's nothing you need to do</strong> &dash; your booking is still confirmed and remains exactly as before:</p>
    ${detailsTable([
      ['Date', formatEmailDate(data.reservationDate)],
      ['Time', data.reservationTime],
      ['Guests', String(data.guests)],
      ['Notes', data.dietaryRequirements || 'None'],
    ])}
    <p style="margin:16px 0 0;font-size:15px;color:#333333;">If you'd like to change or cancel your booking, please use the new link below from now on. Any older links from our previous system will no longer work.</p>
    <p style="margin:16px 0 0;font-size:15px;color:#333333;">We look forward to seeing you!</p>
    ${manageLink}`;

  return { subject, html: emailWrapper(data.tenantName, 'Your booking is confirmed', body) };
}
