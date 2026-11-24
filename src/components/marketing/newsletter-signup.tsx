import Link from "next/link";
import ui from "./phase-one.module.css";

function newsletterFormEnabled() {
  return (
    process.env.CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED === "1"
    && process.env.CONSTRUCTA_REVIEW_ONLY !== "1"
    && process.env.VERCEL_ENV !== "preview"
  );
}

// A101: optional updates list. Default-off: the form renders only when
// CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED=1, and never in protected review or
// preview deployments. When disabled, a static section explains that email
// updates are not available yet (forms OFF) without collecting addresses.
function showNewsletterPreview() {
  return (
    process.env.CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED !== "1"
    && process.env.CONSTRUCTA_REVIEW_ONLY !== "1"
    && process.env.VERCEL_ENV !== "preview"
  );
}

export function NewsletterSignup() {
  if (newsletterFormEnabled()) {
    return (
      <section aria-labelledby="newsletter-heading">
        <h2 id="newsletter-heading">Constructa updates</h2>
        <p>
          Product news and launch updates for construction businesses. This list
          is separate from a Constructa account.
        </p>
        <form action="https://app.convertkit.com/forms/7919715/subscriptions" method="post">
          <label htmlFor="newsletter-email">Email for Constructa updates</label>
          <input id="newsletter-email" name="email_address" type="email" autoComplete="email" required />
          <button type="submit">Subscribe to updates</button>
        </form>
        <p>
          Submitting this form sends your email address to Kit (ConvertKit), the
          email provider that runs this list.
        </p>
      </section>
    );
  }

  if (!showNewsletterPreview()) {
    return null;
  }

  return (
    <section
      className={`${ui.theme} ${ui.section} ${ui.invitation}`}
      data-reveal
      data-newsletter-preview-note
      aria-labelledby="newsletter-heading"
    >
      <p className={ui.eyebrow}>Optional updates</p>
      <h2 id="newsletter-heading">Constructa updates</h2>
      <p>
        Product news for construction businesses. Email updates are not available
        yet in this preview.
      </p>
      <p>
        <Link href="/guides" className={ui.textLink}>
          Browse the guides
        </Link>{" "}
        for practical walkthroughs you can use now.
      </p>
    </section>
  );
}