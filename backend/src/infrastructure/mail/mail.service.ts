import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppConfig, MailConfig } from '../../config/configuration';
import { buildVerificationEmail } from './templates/verification-email.template';
import { buildPasswordResetEmail } from './templates/password-reset-email.template';
import type { RenderedEmail } from './templates/verification-email.template';

/**
 * Thrown whenever the underlying SMTP transport fails. Callers get a stable,
 * controlled error instead of a raw nodemailer/socket error — never leaks
 * transport internals (host, credentials) to callers or HTTP responses.
 */
export class MailDeliveryException extends Error {
  constructor(cause: unknown) {
    super('Failed to deliver email');
    this.name = 'MailDeliveryException';
    this.cause = cause;
  }
}

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const mailConfig = this.configService.get<MailConfig>('mail');
    this.from = mailConfig?.from ?? 'no-reply@example.com';
    this.transporter = nodemailer.createTransport({
      host: mailConfig?.host,
      port: mailConfig?.port,
      secure: false,
      auth:
        mailConfig?.user && mailConfig?.password
          ? { user: mailConfig.user, pass: mailConfig.password }
          : undefined,
    });
  }

  async sendWelcomeEmail(
    to: string,
    fullName: string,
    locale: 'vi' | 'en',
  ): Promise<void> {
    const subject =
      locale === 'vi' ? 'Chào mừng bạn đến với hệ thống' : 'Welcome aboard';
    const text =
      locale === 'vi'
        ? `Xin chào ${fullName}, tài khoản của bạn đã được tạo thành công.`
        : `Hello ${fullName}, your account has been created successfully.`;

    await this.deliver({ to, subject, text });
    this.logger.log('Welcome email queued for delivery to recipient');
  }

  async sendVerificationEmail(
    to: string,
    fullName: string,
    verificationUrl: string,
    expiresInHours: number,
    locale: 'vi' | 'en',
  ): Promise<void> {
    const email = buildVerificationEmail({
      fullName,
      verificationUrl,
      expiresInHours,
      appName: this.appName(),
      locale,
    });
    await this.deliver({ to, ...email });
    this.logger.log('Verification email queued for delivery to recipient');
  }

  async sendPasswordResetEmail(
    to: string,
    fullName: string,
    resetUrl: string,
    expiresInMinutes: number,
    locale: 'vi' | 'en',
  ): Promise<void> {
    const email = buildPasswordResetEmail({
      fullName,
      resetUrl,
      expiresInMinutes,
      appName: this.appName(),
      locale,
    });
    await this.deliver({ to, ...email });
    this.logger.log('Password reset email queued for delivery to recipient');
  }

  private appName(): string {
    return this.configService.get<AppConfig>('app')?.appName ?? 'E-commerce';
  }

  private async deliver(
    message: { to: string } & Partial<RenderedEmail>,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    } catch (error) {
      // Never log the raw SMTP error: it may embed the target address or
      // transport host details. Log metadata only.
      this.logger.error('SMTP delivery failed');
      throw new MailDeliveryException(error);
    }
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
