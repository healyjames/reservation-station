import { vi, describe, it, expect, beforeEach } from 'vitest';
import { sendEmail } from '../src/utils/email';
import type { EmailEnv, SendEmailRequest } from '../src/types';

const mockMessage: SendEmailRequest = {
  to: 'customer@example.com',
  from: '"Test Restaurant" <bookings@mail.test>',
  reply_to: 'owner@restaurant.com',
  subject: 'Your booking is confirmed',
  html: '<p>Hello</p>',
};

let send: ReturnType<typeof vi.fn>;
let mockEnv: EmailEnv;

beforeEach(() => {
  send = vi.fn().mockResolvedValue({ messageId: 'abc123' });
  mockEnv = { EMAIL: { send }, EMAIL_FROM_ADDRESS: 'bookings@mail.test' } as unknown as EmailEnv;
});

describe('sendEmail', () => {
  it('calls the EMAIL binding send() with the mapped message', async () => {
    await sendEmail(mockEnv, mockMessage);
    expect(send).toHaveBeenCalledWith({
      to: mockMessage.to,
      from: mockMessage.from,
      subject: mockMessage.subject,
      html: mockMessage.html,
      replyTo: mockMessage.reply_to,
    });
  });

  it('maps reply_to to replyTo', async () => {
    await sendEmail(mockEnv, mockMessage);
    const [arg] = send.mock.calls[0] as [Record<string, unknown>];
    expect(arg.replyTo).toBe('owner@restaurant.com');
    expect('reply_to' in arg).toBe(false);
  });

  it('omits replyTo when reply_to is not provided', async () => {
    await sendEmail(mockEnv, { ...mockMessage, reply_to: undefined });
    const [arg] = send.mock.calls[0] as [Record<string, unknown>];
    expect('replyTo' in arg).toBe(false);
  });

  it('throws when send() rejects, surfacing code and message', async () => {
    send.mockRejectedValue(Object.assign(new Error('bad recipient'), { code: 'E_SEND' }));
    await expect(sendEmail(mockEnv, mockMessage)).rejects.toThrow(/E_SEND/);
    await expect(sendEmail(mockEnv, mockMessage)).rejects.toThrow(/bad recipient/);
  });

  it('resolves successfully when send() resolves', async () => {
    await expect(sendEmail(mockEnv, mockMessage)).resolves.toBeUndefined();
  });
});
