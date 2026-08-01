import { escapeHtml } from './escape-html.util';

export interface VerificationEmailParams {
  fullName: string;
  verificationUrl: string;
  expiresInHours: number;
  appName: string;
  locale: 'vi' | 'en';
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildVerificationEmail(
  params: VerificationEmailParams,
): RenderedEmail {
  const { fullName, verificationUrl, expiresInHours, appName, locale } = params;

  if (locale === 'en') {
    const subject = `Verify your ${appName} account`;
    const text = [
      `Hi ${fullName},`,
      '',
      `Please verify your ${appName} account by opening the link below:`,
      verificationUrl,
      '',
      `This link expires in ${expiresInHours} hours.`,
      '',
      "If you didn't create this account, you can safely ignore this email.",
      '',
      `— ${appName} support`,
    ].join('\n');
    const html = renderHtml({
      appName,
      fullName,
      verificationUrl,
      expiresInHours,
      greeting: `Hi ${escapeHtml(fullName)},`,
      intro: `Please verify your ${escapeHtml(appName)} account by clicking the button below:`,
      buttonLabel: 'Verify account',
      fallbackLabel: "If the button doesn't work, copy this link:",
      expiryNote: `This link expires in ${expiresInHours} hours.`,
      ignoreNote:
        "If you didn't create this account, you can safely ignore this email.",
    });
    return { subject, html, text };
  }

  const subject = `Xác minh tài khoản ${appName}`;
  const text = [
    `Xin chào ${fullName},`,
    '',
    `Vui lòng xác minh tài khoản ${appName} bằng cách mở đường dẫn dưới đây:`,
    verificationUrl,
    '',
    `Đường dẫn này hết hạn sau ${expiresInHours} giờ.`,
    '',
    'Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.',
    '',
    `— Đội ngũ hỗ trợ ${appName}`,
  ].join('\n');
  const html = renderHtml({
    appName,
    fullName,
    verificationUrl,
    expiresInHours,
    greeting: `Xin chào ${escapeHtml(fullName)},`,
    intro: `Vui lòng xác minh tài khoản ${escapeHtml(appName)} bằng cách bấm nút bên dưới:`,
    buttonLabel: 'Xác minh tài khoản',
    fallbackLabel: 'Nếu nút không hoạt động, hãy sao chép đường dẫn sau:',
    expiryNote: `Đường dẫn này hết hạn sau ${expiresInHours} giờ.`,
    ignoreNote:
      'Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.',
  });
  return { subject, html, text };
}

function renderHtml(params: {
  appName: string;
  fullName: string;
  verificationUrl: string;
  expiresInHours: number;
  greeting: string;
  intro: string;
  buttonLabel: string;
  fallbackLabel: string;
  expiryNote: string;
  ignoreNote: string;
}): string {
  const {
    appName,
    verificationUrl,
    greeting,
    intro,
    buttonLabel,
    fallbackLabel,
    expiryNote,
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
            <a href="${verificationUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">${buttonLabel}</a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;">${fallbackLabel}</p>
          <p style="margin:0 0 24px;font-size:13px;word-break:break-all;color:#3f3f46;">${verificationUrl}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;">${expiryNote}</p>
          <p style="margin:0;font-size:13px;color:#71717a;">${ignoreNote}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
