import { escapeHtml } from './escape-html.util';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert('x') & "y"</script>`)).toBe(
      '&lt;script&gt;alert(&#39;x&#39;) &amp; &quot;y&quot;&lt;/script&gt;',
    );
  });

  it('leaves Unicode names untouched', () => {
    expect(escapeHtml('Nguyễn Văn Ánh')).toBe('Nguyễn Văn Ánh');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});
