import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Admin } from "./Admin";
import "../styles/base.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
);
