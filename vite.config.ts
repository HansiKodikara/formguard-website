import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2022",
    rollupOptions: {
      // lab/ and og/ pages are dev-only tools (figure test bench, Open Graph renderer)
      input: { main: r("index.html"), styleguide: r("styleguide/index.html") },
    },
  },
});
