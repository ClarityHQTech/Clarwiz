import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

// Pull DATABASE_URL out of .env (not auto-loaded by vitest) so DB integration
// tests can hit the local clarwiz_v2 dev DB. Plain unit tests ignore it.
function envFromDotenv(key) {
  try {
    const txt = readFileSync(new URL("./.env", import.meta.url), "utf8");
    const m = txt.match(new RegExp(`^${key}=(.*)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
    env: {
      SECRET: "vitest-unit-test-secret-do-not-use-in-prod",
      DATABASE_URL: envFromDotenv("DATABASE_URL"),
    },
  },
});
