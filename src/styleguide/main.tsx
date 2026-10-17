import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { Styleguide } from "./Styleguide";
import "../styles/base.css";

const el = document.getElementById("root")!;
const app = (
  <StrictMode>
    <Styleguide />
  </StrictMode>
);
if (el.firstElementChild) hydrateRoot(el, app);
else createRoot(el).render(app);
