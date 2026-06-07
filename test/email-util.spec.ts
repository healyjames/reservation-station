import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sendEmail } from '../src/utils/email';
import type { ResendEnv, SendEmailRequest } from '../src/utils/email';

const mockEnv: ResendEnv = { RESEND_API_KEY: 're_test_abc123' };
const mockMessage: SendEmailRequest = {
	to: 'customer@example.com',
	from: '"Test Restaurant" <noreply@test.com>',
	subject: 'Your booking is confirmed',
	html: '<p>Hello</p>',
};

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
	mockFetch = vi.fn();
	vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('sendEmail', () => {
	it('sends POST request to Resend API with correct URL', async () => {
		mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
		await sendEmail(mockEnv, mockMessage);
		expect(mockFetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.any(Object));
	});

	it('sends correct Authorization header', async () => {
		mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
		await sendEmail(mockEnv, mockMessage);
		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		const headers = new Headers(init.headers as HeadersInit);
		expect(headers.get('Authorization')).toBe('Bearer re_test_abc123');
	});

	it('sends correct payload', async () => {
		mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
		await sendEmail(mockEnv, mockMessage);
		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		const body = JSON.parse(init.body as string);
		expect(body).toMatchObject({
			to: mockMessage.to,
			from: mockMessage.from,
			subject: mockMessage.subject,
			html: mockMessage.html,
		});
	});

	it('throws when Resend returns 400', async () => {
		mockFetch.mockResolvedValue(new Response(null, { status: 400 }));
		await expect(sendEmail(mockEnv, mockMessage)).rejects.toThrow();
	});

	it('throws when Resend returns 422', async () => {
		mockFetch.mockResolvedValue(new Response(null, { status: 422 }));
		await expect(sendEmail(mockEnv, mockMessage)).rejects.toThrow();
	});

	it('resolves successfully when Resend returns 200', async () => {
		mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
		await expect(sendEmail(mockEnv, mockMessage)).resolves.toBeUndefined();
	});
});
