import { buildVerificationEmail } from './verification-email.template';

const baseParams = {
  fullName: 'Nguyễn Văn Ánh',
  verificationUrl: 'http://localhost:3001/verify-email?token=abc123',
  expiresInHours: 24,
  appName: 'E-commerce',
  locale: 'vi' as const,
};

describe('buildVerificationEmail', () => {
  it('produces a clear Vietnamese subject naming the app', () => {
    const { subject } = buildVerificationEmail(baseParams);
    expect(subject).toContain('E-commerce');
    expect(subject.length).toBeGreaterThan(0);
  });

  it('includes the verification URL in both html and text bodies', () => {
    const { html, text } = buildVerificationEmail(baseParams);
    expect(html).toContain(baseParams.verificationUrl);
    expect(text).toContain(baseParams.verificationUrl);
  });

  it('states the link expiry window', () => {
    const { html, text } = buildVerificationEmail(baseParams);
    expect(html).toContain('24');
    expect(text).toContain('24');
  });

  it('warns the recipient to ignore the email if they did not register', () => {
    const { html, text } = buildVerificationEmail(baseParams);
    expect(html.toLowerCase()).toContain('bỏ qua');
    expect(text.toLowerCase()).toContain('bỏ qua');
  });

  it('escapes HTML-significant characters in the user-supplied name', () => {
    const { html } = buildVerificationEmail({
      ...baseParams,
      fullName: `<img src=x onerror=alert(1)>`,
    });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('renders Unicode names correctly without mangling', () => {
    const { html, text } = buildVerificationEmail(baseParams);
    expect(html).toContain('Nguyễn Văn Ánh');
    expect(text).toContain('Nguyễn Văn Ánh');
  });

  it('never includes SMTP credentials or secrets in the output', () => {
    const { subject, html, text } = buildVerificationEmail(baseParams);
    const combined = `${subject}\n${html}\n${text}`;
    expect(combined).not.toMatch(/smtp|password|secret/i);
  });

  it('supports an English locale', () => {
    const { subject, html, text } = buildVerificationEmail({
      ...baseParams,
      locale: 'en',
    });
    expect(subject.toLowerCase()).toContain('verify');
    expect(html).toContain(baseParams.verificationUrl);
    expect(text.toLowerCase()).toContain('ignore');
  });
});
