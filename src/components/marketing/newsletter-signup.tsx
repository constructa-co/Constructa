// A101: optional updates list. Default-off: the form renders only when
// CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED=1, and never in protected review or
// preview deployments. Subscribing posts the email address straight to the
// email provider; a submit is a request to subscribe, not a confirmed
// subscription, and no measurement event is attached to it.
export function NewsletterSignup() {
  if (process.env.CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED !== '1'
    || process.env.CONSTRUCTA_REVIEW_ONLY === '1'
    || process.env.VERCEL_ENV === 'preview') {
    return null;
  }

  return (
    <section aria-labelledby="newsletter-heading">
      <h2 id="newsletter-heading">Constructa updates</h2>
      <p>
        Occasional product news and launch updates for construction businesses.
        This list is separate from a Constructa account, and your email address
        is used only for these updates.
      </p>
      <form action="https://app.convertkit.com/forms/7919715/subscriptions" method="post">
        <label htmlFor="newsletter-email">Email for Constructa updates</label>
        <input id="newsletter-email" name="email_address" type="email" autoComplete="email" required />
        <button type="submit">Subscribe to updates</button>
      </form>
      <p>
        Subscribing sends your email address to Kit (ConvertKit), the email
        provider that runs this list.
      </p>
    </section>
  );
}
