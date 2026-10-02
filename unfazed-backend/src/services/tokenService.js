import jwt from 'jsonwebtoken';
export function issueToken(subject, role = 'therapist', claims = {}) {
  return jwt.sign({ role, ...claims }, process.env.JWT_SECRET, {
    subject: String(subject),
    expiresIn: role === 'therapist' ? '8h' : '24h',
    issuer: 'unfazed',
    audience: 'unfazed-app',
    algorithm: 'HS256',
  });
}
export function readToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    issuer: 'unfazed',
    audience: 'unfazed-app',
    algorithms: ['HS256'],
  });
}
