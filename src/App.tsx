import { Header } from "./components/Header";
import { Hero } from "./sections/Hero";
import { Problem } from "./sections/Problem";
import { HowItWorks } from "./sections/HowItWorks";
import { useCaps } from "./lib/env";

export function App() {
  const caps = useCaps();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-chalk focus:px-4 focus:py-2 focus:text-iron">Skip to content</a>
      <Header />
      <main id="main">
        <Hero caps={caps} />
        <Problem caps={caps} />
        <HowItWorks caps={caps} />
      </main>
    </>
  );
}
