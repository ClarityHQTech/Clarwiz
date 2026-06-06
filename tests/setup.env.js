// Loads the project's .env (incl. DATABASE_URL, SECRET, HUBSPOT_PRIVATE_APP_TOKEN)
// for tests, using the same loader Next.js uses. Unit tests still override SECRET
// locally; live tests (RUN_LIVE_CHECKPOINT=1) need the real values.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
