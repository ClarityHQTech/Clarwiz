import fs from "fs";

const LOG_PATH =
  "/Users/prashant/Desktop/M360/code/clarwiz/.cursor/debug-535418.log";

/** Debug-mode NDJSON logger (server-side; writes to session log file). */
export function agentDebugLog(payload) {
  const line = JSON.stringify({
    sessionId: "535418",
    timestamp: Date.now(),
    ...payload,
  });
  try {
    fs.appendFileSync(LOG_PATH, `${line}\n`);
  } catch {
    /* ignore */
  }
  fetch("http://127.0.0.1:7573/ingest/e424d07e-5168-4799-bde5-f277a90c6c9e", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "535418",
    },
    body: line,
  }).catch(() => {});
}
