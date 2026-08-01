import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService, MailDeliveryException } from './mail.service';

jest.mock('nodemailer');

interface SentMail {
  to: string;
  from: string;
  subject?: string;
  html?: string;
  text?: string;
}

describe('MailService', () => {
  let sendMail: jest.Mock<Promise<{ messageId: string }>, [SentMail]>;
  let configService: ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail = jest.fn<Promise<{ messageId: string }>, [SentMail]>();
    sendMail.mockResolvedValue({ messageId: 'test' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail,
      close: jest.fn(),
    });
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'mail') {
          return {
            host: 'localhost',
            port: 1025,
            from: 'no-reply@example.com',
          };
        }
        if (key === 'app') {
          return { appName: 'E-commerce' };
        }
        return undefined;
      }),
    } as unknown as ConfigService;
  });

  it('sends a verification email with subject, html and text containing the verification URL', async () => {
    const service = new MailService(configService);
    await service.sendVerificationEmail(
      'user@example.com',
      'Nguyễn Văn A',
      'http://localhost:3001/verify-email?token=abc',
      24,
      'vi',
    );

    expect(sendMail).toHaveBeenCalledTimes(1);
    const call = sendMail.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.from).toBe('no-reply@example.com');
    expect(call.html).toContain('http://localhost:3001/verify-email?token=abc');
    expect(call.text).toContain('http://localhost:3001/verify-email?token=abc');
  });

  it('sends a password reset email with subject, html and text containing the reset URL', async () => {
    const service = new MailService(configService);
    await service.sendPasswordResetEmail(
      'user@example.com',
      'Nguyễn Văn A',
      'http://localhost:3001/reset-password?token=abc',
      60,
      'vi',
    );

    expect(sendMail).toHaveBeenCalledTimes(1);
    const call = sendMail.mock.calls[0][0];
    expect(call.html).toContain(
      'http://localhost:3001/reset-password?token=abc',
    );
    expect(call.text).toContain(
      'http://localhost:3001/reset-password?token=abc',
    );
  });

  it('wraps SMTP transport failures into a controlled MailDeliveryException', async () => {
    sendMail.mockRejectedValue(new Error('ECONNREFUSED'));
    const service = new MailService(configService);

    await expect(
      service.sendVerificationEmail(
        'user@example.com',
        'A',
        'http://localhost:3001/verify-email?token=abc',
        24,
        'vi',
      ),
    ).rejects.toBeInstanceOf(MailDeliveryException);
  });

  it('reuses a single transporter instance across multiple sends (no per-email connection)', async () => {
    const service = new MailService(configService);
    await service.sendVerificationEmail(
      'a@example.com',
      'A',
      'http://localhost:3001/verify-email?token=1',
      24,
      'vi',
    );
    await service.sendPasswordResetEmail(
      'b@example.com',
      'B',
      'http://localhost:3001/reset-password?token=2',
      60,
      'vi',
    );

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });
});
