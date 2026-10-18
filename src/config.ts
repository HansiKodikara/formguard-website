/** Site-wide settings you'll want to change before launch. */
export const SITE = {
  name: "FormGuard",
  tagline: "Coaching, without the coach.",
  oneLiner: "FormGuard helps lifters fix their form without a personal trainer, using a sensor suit and AI.",
  /** placeholder — replace with the real inbox before launch */
  contactEmail: "hello@formguard.example",
  /** where the waitlist form posts: the site's own API (api/signup.ts), unless VITE_TEST_LIFTER_ENDPOINT says otherwise */
  formEndpoint: (import.meta.env.VITE_TEST_LIFTER_ENDPOINT as string | undefined) || "/api/signup",
};
