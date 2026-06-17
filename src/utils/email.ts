export interface ResendEnv {
	RESEND_API_KEY: string;
}

export interface EmailTemplate {
	subject: string;
	html: string;
}

export interface SendEmailRequest {
	to: string;
	from: string;
	reply_to?: string;
	subject: string;
	html: string;
}

export interface ReservationEmailContext {
	reservationId: string;
	tenantId: string;
	tenantName: string;
	tenantContactEmail: string | null;
	firstName: string;
	surname: string;
	telephone: string;
	customerEmail: string;
	reservationDate: string;
	reservationTime: string;
	guests: number;
	dietaryRequirements: string | null;
}

export interface CustomerReservationEmailData {
	tenantName: string;
	firstName: string;
	reservationDate: string;
	reservationTime: string;
	guests: number;
	dietaryRequirements: string | null;
	reservationId?: string;
	customerEmail?: string;
	baseUrl?: string;
	manageToken?: string;
}

export interface TenantReservationEmailData {
	tenantName: string;
	reservationId: string;
	firstName: string;
	surname: string;
	telephone: string;
	customerEmail: string;
	reservationDate: string;
	reservationTime: string;
	guests: number;
	dietaryRequirements: string | null;
}

export async function sendEmail(env: ResendEnv, message: SendEmailRequest): Promise<void> {
	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: message.from,
			to: message.to,
			...(message.reply_to ? { reply_to: message.reply_to } : {}),
			subject: message.subject,
			html: message.html,
		}),
	});

	if (!response.ok) {
		throw new Error(`Resend API error: ${response.status} ${response.statusText}`);
	}
}
