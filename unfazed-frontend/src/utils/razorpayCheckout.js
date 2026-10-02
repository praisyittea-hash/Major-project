let loaded;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!loaded)
    loaded = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => {
        loaded = null;
        script.remove();
        reject(new Error('Unable to load checkout. Check your connection and try again.'));
      };
      document.head.append(script);
    });
  return loaded;
}
