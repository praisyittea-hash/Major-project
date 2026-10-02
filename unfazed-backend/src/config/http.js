export function allowedOrigins(env = process.env) {
  return (env.FRONTEND_URLS || env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((value) => new URL(value.trim()).origin);
}
export function corsOrigin(origin, callback) {
  callback(null, !origin || allowedOrigins().includes(origin));
}
export function proxyHops(env = process.env) {
  const hops = Number(env.TRUST_PROXY_HOPS ?? (env.NODE_ENV === 'production' ? 1 : 0));
  if (!Number.isInteger(hops) || hops < 0 || hops > 5)
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5');
  return hops;
}
