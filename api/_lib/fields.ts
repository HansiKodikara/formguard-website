/** The waitlist's answers, shared by the form (src/sections/TestLifter.tsx) and the API that checks them. */
export const LIFTS = ["Squat", "Deadlift", "Bench", "Overhead press", "Curls", "Other"] as const;
export const FREQ = [
  { value: "1-2", label: "1–2× a week" },
  { value: "3-4", label: "3–4×" },
  { value: "5+", label: "5+" },
] as const;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
