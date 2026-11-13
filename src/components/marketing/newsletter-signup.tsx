export function NewsletterSignup() {
  if (process.env.CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED !== '1'
    || process.env.CONSTRUCTA_REVIEW_ONLY === '1'
    || process.env.VERCEL_ENV === 'preview') {
    return null;
  }

  return (
    <form action="https://app.convertkit.com/forms/7919715/subscriptions" method="post">
      <label htmlFor="newsletter-email">Email for Constructa updates</label>
      <input id="newsletter-email" name="email_address" type="email" autoComplete="email" required />
      <button type="submit">Subscribe to updates</button>
    </form>
  );
}
