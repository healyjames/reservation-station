import type { EmailEnv, SendEmailRequest } from '../types';

export async function sendEmail(env: EmailEnv, message: SendEmailRequest): Promise<void> {
  try {
    const result = await env.EMAIL.send({
      to: message.to,
      from: message.from,
      subject: message.subject,
      html: message.html,
      ...(message.text ? { text: message.text } : {}),
      ...(message.reply_to ? { replyTo: message.reply_to } : {}),
    });
    console.log(`[email] sent to ${message.to} (messageId: ${result?.messageId ?? 'unknown'})`);
  } catch (error) {
    const e = error as { code?: string; message?: string };
    throw new Error(`Cloudflare Email send failed: ${e.code ?? ''} ${e.message ?? String(error)}`.trim());
  }
}
