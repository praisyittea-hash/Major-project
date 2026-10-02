import { useEffect } from 'react';
export default function useProfileMetadata(profile) {
  useEffect(() => {
    if (!profile) return;
    const oldTitle = document.title;
    document.title = `${profile.name} | Unfazed`;
    const inserted = [];
    for (const [property, content] of Object.entries({
      'og:title': document.title,
      'og:description': profile.bio.slice(0, 200),
      'og:type': 'profile',
      'og:url': `${location.origin}/${profile.slug}`,
    })) {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.append(meta);
        inserted.push(meta);
      }
      meta.content = content;
    }
    return () => {
      document.title = oldTitle;
      inserted.forEach((meta) => meta.remove());
    };
  }, [profile]);
}
