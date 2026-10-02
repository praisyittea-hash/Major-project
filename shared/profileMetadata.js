const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function injectProfileMetadata(html, therapist, baseUrl) {
  const title = `${therapist.name} | Unfazed`;
  const description =
    String(therapist.bio || '').slice(0, 200) || `Book a session with ${therapist.name}`;
  const url = `${baseUrl.replace(/\/$/, '')}/${therapist.slug}`;
  return html
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(
      '</head>',
      `<meta name="description" content="${escape(description)}"/><meta property="og:title" content="${escape(title)}"/><meta property="og:description" content="${escape(description)}"/><meta property="og:type" content="profile"/><meta property="og:url" content="${escape(url)}"/><meta property="og:site_name" content="Unfazed"/><meta name="twitter:card" content="summary"/></head>`,
    );
}
