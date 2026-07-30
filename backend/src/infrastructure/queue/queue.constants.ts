export const EMAIL_QUEUE = 'email';

export enum EmailJobName {
  SEND_WELCOME_EMAIL = 'send-welcome-email',
}

export interface SendWelcomeEmailJobData {
  userId: string;
  email: string;
  fullName: string;
  locale: 'vi' | 'en';
}
