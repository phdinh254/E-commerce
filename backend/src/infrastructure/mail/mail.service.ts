import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailConfig } from '../../config/configuration';

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

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
    });
    this.logger.log(`Welcome email queued for delivery to recipient`);
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
