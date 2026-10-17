import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/base.css";

const el = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);
// prerendered at build time (scripts/prerender.mjs) → hydrate; in dev → render
if (el.firstElementChild) hydrateRoot(el, app);
else createRoot(el).render(app);
