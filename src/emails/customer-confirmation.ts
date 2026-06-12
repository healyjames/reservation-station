import type { CustomerReservationEmailData, EmailTemplate } from '../utils/email';

function detailsTable(rows: [string, string][]): string {
	const cells = rows
		.map(
			([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#666666;font-size:14px;width:160px;vertical-align:top;">${label}</td>
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

export function buildCustomerConfirmationEmail(data: CustomerReservationEmailData): EmailTemplate {
	const subject = `Your booking at ${data.tenantName} is confirmed`;

	const links =
		data.baseUrl && data.reservationId && data.customerEmail
			? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse;">
      <tr>
        <td style="padding-bottom:8px;">
          <a href="${data.baseUrl}/booking/?id=${data.reservationId}&email=${encodeURIComponent(data.customerEmail)}"
             style="display:inline-block;padding:10px 20px;background-color:#266663;color:#ffffff;text-decoration:none;font-size:14px;border-radius:4px;">
            Manage my booking
          </a>
        </td>
      </tr>
      <tr>
        <td>
          <a href="${data.baseUrl}/cancel?id=${data.reservationId}&email=${encodeURIComponent(data.customerEmail)}"
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
		['Date', data.reservationDate],
		['Time', data.reservationTime],
		['Guests', String(data.guests)],
		['Dietary requirements', data.dietaryRequirements || 'None'],
	])}
    <p style="margin:16px 0 0;font-size:15px;color:#333333;">We look forward to seeing you!</p>
    ${links}`;

	return { subject, html: emailWrapper(data.tenantName, 'Booking Confirmed', body) };
}

