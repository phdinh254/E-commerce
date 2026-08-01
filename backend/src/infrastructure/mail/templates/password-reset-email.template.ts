import { escapeHtml } from './escape-html.util';
import type { RenderedEmail } from './verification-email.template';

export interface PasswordResetEmailParams {
  fullName: string;
  resetUrl: string;
  expiresInMinutes: number;
  appName: string;
  locale: 'vi' | 'en';
}

export function buildPasswordResetEmail(
  params: PasswordResetEmailParams,
): RenderedEmail {
  const { fullName, resetUrl, expiresInMinutes, appName, locale } = params;

  if (locale === 'en') {
    const subject = `Reset your ${appName} password`;
    const text = [
      `Hi ${fullName},`,
      '',
      `We received a request to reset your ${appName} password. Open the link below to choose a new one:`,
      resetUrl,
      '',
      `This link expires in ${expiresInMinutes} minutes.`,
      '',
      'Do not share this link with anyone.',
      "If you didn't request a password reset, you can safely ignore this email — your password will not change.",
      '',
      `— ${appName} support`,
    ].join('\n');
    const html = renderHtml({
      appName,
      resetUrl,
      greeting: `Hi ${escapeHtml(fullName)},`,
      intro: `We received a request to reset your ${escapeHtml(appName)} password. Click the button below to choose a new one:`,
      buttonLabel: 'Reset password',
      fallbackLabel: "If the button doesn't work, copy this link:",
      expiryNote: `This link expires in ${expiresInMinutes} minutes.`,
      shareWarning: 'Do not share this link with anyone.',
      ignoreNote:
        "If you didn't request a password reset, you can safely ignore this email — your password will not change.",
    });
    return { subject, html, text };
  }

  const subject = `Đặt lại mật khẩu ${appName}`;
  const text = [
    `Xin chào ${fullName},`,
    '',
    `Chúng tôi nhận được yêu cầu đặt lại mật khẩu ${appName} của bạn. Mở đường dẫn dưới đây để tạo mật khẩu mới:`,
    resetUrl,
    '',
    `Đường dẫn này hết hạn sau ${expiresInMinutes} phút.`,
    '',
    'Không chia sẻ đường dẫn này với bất kỳ ai.',
    'Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này — mật khẩu của bạn sẽ không thay đổi.',
    '',
    `— Đội ngũ hỗ trợ ${appName}`,
  ].join('\n');
  const html = renderHtml({
    appName,
    resetUrl,
    greeting: `Xin chào ${escapeHtml(fullName)},`,
    intro: `Chúng tôi nhận được yêu cầu đặt lại mật khẩu ${escapeHtml(appName)} của bạn. Bấm nút bên dưới để tạo mật khẩu mới:`,
    buttonLabel: 'Đặt lại mật khẩu',
    fallbackLabel: 'Nếu nút không hoạt động, hãy sao chép đường dẫn sau:',
    expiryNote: `Đường dẫn này hết hạn sau ${expiresInMinutes} phút.`,
    shareWarning: 'Không chia sẻ đường dẫn này với bất kỳ ai.',
    ignoreNote:
      'Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này — mật khẩu của bạn sẽ không thay đổi.',
  });
  return { subject, html, text };
}

function renderHtml(params: {
  appName: string;
  resetUrl: string;
  greeting: string;
  intro: string;
  buttonLabel: string;
  fallbackLabel: string;
  expiryNote: string;
  shareWarning: string;
  ignoreNote: string;
}): string {
  const {
    appName,
    resetUrl,
    greeting,
    intro,
    buttonLabel,
    fallbackLabel,
    expiryNote,
    shareWarning,
    ignoreNote,
  } = params;

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(appName)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr>
        <td>
          <p style="font-size:18px;font-weight:600;margin:0 0 16px;">${escapeHtml(appName)}</p>
          <p style="margin:0 0 16px;">${greeting}</p>
          <p style="margin:0 0 24px;">${intro}</p>
          <p style="margin:0 0 24px;text-align:center;">
            <a href="${resetUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">${buttonLabel}</a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;">${fallbackLabel}</p>
          <p style="margin:0 0 24px;font-size:13px;word-break:break-all;color:#3f3f46;">${resetUrl}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;">${expiryNote}</p>
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#b91c1c;">${shareWarning}</p>
          <p style="margin:0;font-size:13px;color:#71717a;">${ignoreNote}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
