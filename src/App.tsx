import { Logo } from "./components/Logo";

export function App() {
  return (
    <main className="surface-iron grain min-h-screen wrap py-24">
      <Logo tone="reversed" height={32} />
      <h1 className="t-display text-h1 mt-16 uppercase">Coaching,<br />without the coach.</h1>
    </main>
  );
}
