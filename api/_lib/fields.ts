/** The sign-up form's answers, shared by the form (src/sections/TestLifter.tsx), the API that checks them and /admin. */
export const INTENTS = [
  { value: "tester", label: "I want to be a test lifter (you'll get launch updates too)" },
  { value: "updates", label: "Not ready to test? Just send me launch updates." },
] as const;
export const LIFTS = ["Squat", "Deadlift", "Bench", "Overhead press", "Curls", "Other"] as const;
export const FREQ = [
  { value: "starting", label: "Just starting" },
  { value: "1-2", label: "1–2× a week" },
  { value: "3-4", label: "3–4× a week" },
  { value: "5+", label: "5+ a week" },
] as const;
export const SOURCES = ["Venture Showcase", "LinkedIn", "Friend", "Other"] as const;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ROLES = ["Lifter", "Investor", "Mentor or industry", "Other"] as const;
export const MESSAGE_MAX = 4000;
