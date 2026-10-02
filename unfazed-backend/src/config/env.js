export function validateEnv(env = process.env) {
  if (!env.MONGO_URI) throw new Error('MONGO_URI is required');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || env.JWT_SECRET.startsWith('replace-'))
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters');
  if (env.RAZORPAY_KEY_ID || env.RAZORPAY_KEY_SECRET) {
    if (
      !env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') ||
      !env.RAZORPAY_KEY_SECRET ||
      !env.RAZORPAY_WEBHOOK_SECRET ||
      env.RAZORPAY_WEBHOOK_SECRET.length < 20
    )
      throw new Error('Payments require Razorpay test keys and a webhook secret (20+ characters)');
  }
  return env;
}
