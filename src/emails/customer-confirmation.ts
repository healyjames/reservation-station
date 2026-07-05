import type { CustomerReservationEmailData, EmailTemplate } from '../types';
import { formatEmailDate } from '../utils/formatEmailDate';
import { detailsTable, emailWrapper } from './helpers';

export function buildCustomerConfirmationEmail(data: CustomerReservationEmailData): EmailTemplate {
  const subject = `Your booking at ${data.tenantName} is confirmed`;

  const links =
    data.baseUrl && data.reservationId && data.customerEmail
      ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse;">
      <tr>
        <td style="padding-bottom:8px;">
          <a href="${data.baseUrl}/booking/?id=${data.reservationId}&email=${encodeURIComponent(data.customerEmail)}${data.manageToken ? `&token=${data.manageToken}` : ''}"
             style="display:inline-block;padding:10px 20px;background-color:#266663;color:#ffffff;text-decoration:none;font-size:14px;border-radius:4px;">
            Amend booking
          </a>
        </td>
      </tr>
      <tr>
        <td>
          <a href="${data.baseUrl}/cancel/?id=${data.reservationId}&email=${encodeURIComponent(data.customerEmail)}${data.manageToken ? `&token=${data.manageToken}` : ''}"
             style="font-size:13px;color:#666666;">
            Cancel my booking
          </a>
        </td>
      </tr>
    </table>`
      : '';

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#333333;">Hi ${data.firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#333333;">Your booking has been confirmed. Here are your details:</p>
    ${detailsTable([
      ['Date', formatEmailDate(data.reservationDate)],
      ['Time', data.reservationTime],
      ['Guests', String(data.guests)],
      ['Dietary requirements', data.dietaryRequirements || 'None'],
    ])}
    <p style="margin:16px 0 0;font-size:15px;color:#333333;">We look forward to seeing you!</p>
    ${links}
		<p style="margin:16px 0 0;font-size:11px;color:#333333;">Note: We cannot guarantee requests for specific tables but will endeavor to accommodate them where possible.</p>`;

  return { subject, html: emailWrapper(data.tenantName, 'Booking Confirmed', body) };
}
