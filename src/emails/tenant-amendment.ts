import type { EmailTemplate, TenantReservationEmailData } from '../types';
import { formatEmailDate } from '../utils/formatEmailDate';

function detailsTable(rows: [string, string][]): string {
  const cells = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#666666;font-size:14px;width:180px;vertical-align:top;">${label}</td>
          <td style="padding:8px 0;color:#333333;font-size:14px;vertical-align:top;">${value}</td>
        </tr>`,
    )
    .join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${cells}</table>`;
}

function emailWrapper(tenantName: string, heading: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table class="body" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f6f6;margin:0;padding:0;">
    <tr>
      <td style="padding:20px 0;">
        <table class="container" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;">
          <tr>
            <td>
              <table class="main" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-top:4px solid #266663;border-collapse:collapse;">
                <tr>
                  <td class="wrapper" style="padding:20px;">
                    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#266663;">${heading}</h1>
                    ${body}
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td style="text-align:center;color:#999999;font-size:12px;padding:8px 0;">
                    This email was sent by ${tenantName} via Maximum Bookings.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildTenantAmendmentEmail(data: TenantReservationEmailData): EmailTemplate {
  const subject = `Booking amended: ${data.firstName} ${data.surname} — ${formatEmailDate(data.reservationDate)} at ${data.reservationTime}`;

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#333333;">A booking has been amended. Here are the updated details:</p>
    ${detailsTable([
      ['Customer Name', `${data.firstName} ${data.surname}`],
      ['Email', data.customerEmail],
      ['Phone', data.telephone],
      ['Date', formatEmailDate(data.reservationDate)],
      ['Time', data.reservationTime],
      ['Guests', String(data.guests)],
      ['Dietary Requirements & Special Requests', data.dietaryRequirements || 'None'],
      ['Booking ID', data.reservationId],
    ])}`;

  return { subject, html: emailWrapper(data.tenantName, 'Booking Amended', body) };
}
