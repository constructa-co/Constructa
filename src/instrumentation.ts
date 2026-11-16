export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { refreshUkBankHolidaysFromGovUk } = await import("./lib/uk-bank-holidays-feed");
    void refreshUkBankHolidaysFromGovUk();
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.CONSTRUCTA_REVIEW_ONLY === "1") {
    const { reviewEnabled } = await import("./lib/deployment/review-policy");
    if (reviewEnabled()) {
      const { installReviewRuntime } = await import("./lib/deployment/review-runtime");
      installReviewRuntime();
    }
  }
}
