/**
 * Standard shape returned by channel push functions for the execution layer.
 * @typedef {Object} PushResult
 * @property {'sent'|'queued'|'failed'|'skipped'} status
 * @property {string|null} deliveryProvider
 * @property {Object|null} deliveryMeta
 * @property {string} [deliveryMessage]
 * @property {string} [error]
 * @property {boolean} [skippedSend]
 * @property {string} [reason]
 */

export function buildPushResult({
  status = "sent",
  deliveryProvider = null,
  deliveryMeta = null,
  deliveryMessage,
  renderedMessage,
  error,
  skippedSend,
  reason,
} = {}) {
  return {
    status,
    deliveryProvider,
    deliveryMeta,
    ...(deliveryMessage ? { deliveryMessage } : {}),
    ...(renderedMessage ? { renderedMessage } : {}),
    ...(error ? { error } : {}),
    ...(skippedSend ? { skippedSend: true, reason } : {}),
  };
}

export function buildSkippedPush(reason, deliveryProvider = null) {
  return buildPushResult({
    status: "skipped",
    deliveryProvider,
    skippedSend: true,
    reason,
  });
}
