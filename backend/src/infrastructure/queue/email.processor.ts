import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from '../mail/mail.service';
import {
  EMAIL_QUEUE,
  EmailJobName,
  SendWelcomeEmailJobData,
} from './queue.constants';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(
    job: Job<SendWelcomeEmailJobData, void, EmailJobName>,
  ): Promise<void> {
    switch (job.name) {
      case EmailJobName.SEND_WELCOME_EMAIL:
        await this.handleSendWelcomeEmail(job);
        break;
      default:
        this.logger.warn(`Unhandled job name: ${String(job.name)}`);
    }
  }

  private async handleSendWelcomeEmail(
    job: Job<SendWelcomeEmailJobData, void, EmailJobName>,
  ): Promise<void> {
    const { email, fullName, locale } = job.data;
    await this.mailService.sendWelcomeEmail(email, fullName, locale);
    this.logger.log(`Welcome email dispatched for user ${job.data.userId}`);
  }
}
