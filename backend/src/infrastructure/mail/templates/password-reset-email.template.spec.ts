import { buildPasswordResetEmail } from './password-reset-email.template';

const baseParams = {
  fullName: 'Nguyễn Văn Ánh',
  resetUrl: 'http://localhost:3001/reset-password?token=abc123',
  expiresInMinutes: 60,
  appName: 'E-commerce',
  locale: 'vi' as const,
};

describe('buildPasswordResetEmail', () => {
  it('produces a subject about resetting the password', () => {
    const { subject } = buildPasswordResetEmail(baseParams);
    expect(subject).toContain('E-commerce');
  });

  it('includes the reset URL in both html and text bodies', () => {
    const { html, text } = buildPasswordResetEmail(baseParams);
    expect(html).toContain(baseParams.resetUrl);
    expect(text).toContain(baseParams.resetUrl);
  });

  it('states the link expiry window', () => {
    const { html, text } = buildPasswordResetEmail(baseParams);
    expect(html).toContain('60');
    expect(text).toContain('60');
  });

  it('warns against sharing the link with anyone', () => {
    const { html, text } = buildPasswordResetEmail(baseParams);
    expect(html.toLowerCase()).toContain('không chia sẻ');
    expect(text.toLowerCase()).toContain('không chia sẻ');
  });

  it('tells the recipient to ignore the email if they did not request a reset', () => {
    const { html, text } = buildPasswordResetEmail(baseParams);
    expect(html.toLowerCase()).toContain('bỏ qua');
    expect(text.toLowerCase()).toContain('bỏ qua');
  });

  it('never includes the new password anywhere in the email', () => {
    const { subject, html, text } = buildPasswordResetEmail({
      ...baseParams,
    });
    const combined = `${subject}\n${html}\n${text}`;
    expect(combined).not.toMatch(/new password|mật khẩu mới là/i);
  });

  it('escapes HTML-significant characters in the user-supplied name', () => {
    const { html } = buildPasswordResetEmail({
      ...baseParams,
      fullName: `<img src=x onerror=alert(1)>`,
    });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('renders Unicode names correctly', () => {
    const { html, text } = buildPasswordResetEmail(baseParams);
    expect(html).toContain('Nguyễn Văn Ánh');
    expect(text).toContain('Nguyễn Văn Ánh');
  });

  it('never includes SMTP credentials or secrets in the output', () => {
    const { subject, html, text } = buildPasswordResetEmail(baseParams);
    const combined = `${subject}\n${html}\n${text}`;
    expect(combined).not.toMatch(/smtp|password_hash|secret/i);
  });

  it('does not disclose whether the account exists — content is generic to the recipient only', () => {
    const { html, text } = buildPasswordResetEmail(baseParams);
    expect(html.toLowerCase()).not.toContain('tài khoản không tồn tại');
    expect(text.toLowerCase()).not.toContain('tài khoản không tồn tại');
  });

  it('supports an English locale', () => {
    const { subject, html, text } = buildPasswordResetEmail({
      ...baseParams,
      locale: 'en',
    });
    expect(subject.toLowerCase()).toContain('reset');
    expect(html).toContain(baseParams.resetUrl);
    expect(text.toLowerCase()).toContain('ignore');
  });
});
