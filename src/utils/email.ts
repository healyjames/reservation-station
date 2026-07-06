import type { ResendEnv, SendEmailRequest } from '../types';

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
