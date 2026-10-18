import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Hero } from "./sections/Hero";
import { Suit } from "./sections/Suit";
import { Problem } from "./sections/Problem";
import { HowItWorks } from "./sections/HowItWorks";
import { TryIt } from "./sections/TryIt";
import { TestLifter } from "./sections/TestLifter";
import { useCaps } from "./lib/env";

export function App() {
  const caps = useCaps();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-chalk focus:px-4 focus:py-2 focus:text-iron">Skip to content</a>
      <Header />
      <main id="main">
        <Hero />
        <Suit caps={caps} />
        <Problem />
        <HowItWorks caps={caps} />
        <TryIt />
        <TestLifter />
      </main>
      <Footer />
    </>
  );
}
