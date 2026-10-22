import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Hero } from "./sections/Hero";
import { WhyUs } from "./sections/WhyUs";
import { HowItWorks } from "./sections/HowItWorks";
import { TestLifter } from "./sections/TestLifter";
import { Contact } from "./sections/Contact";
import { useCaps } from "./lib/env";
import { useHashLanding } from "./lib/hash";

export function App() {
  const caps = useCaps();
  useHashLanding();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-chalk focus:px-4 focus:py-2 focus:text-iron">Skip to content</a>
      <Header />
      <main id="main">
        <Hero />
        <WhyUs />
        <HowItWorks caps={caps} />
        <TestLifter />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
