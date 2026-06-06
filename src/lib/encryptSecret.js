import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SCRYPT_SALT_LINKUP = "clarwiz-linkup-account-id";
const SCRYPT_SALT_SMARTLEAD = "clarwiz-smartlead-email-account-id";
const SCRYPT_SALT_WHATSAPP = "clarwiz-whatsapp-access-token";
const SCRYPT_SALT_CALENDLY = "clarwiz-calendly-oauth-token";
const SCRYPT_SALT_WEBHOOK = "clarwiz-integration-webhook-secret";
const SCRYPT_SALT_HUBSPOT = "clarwiz-hubspot-oauth-token";

function deriveKey(salt) {
  const secret = process.env.SECRET?.trim();
  if (!secret) {
    throw new Error("SECRET is not configured");
  }
  return scryptSync(secret, salt, KEY_LENGTH);
}

function encryptWithSalt(plainText, salt) {
  if (!plainText) {
    throw new Error("Cannot encrypt empty value");
  }
  const key = deriveKey(salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptWithSalt(stored, salt, legacyPlaintextPattern) {
  if (!stored) {
    throw new Error("Missing stored value");
  }

  try {
    const buf = Buffer.from(stored, "base64");
    if (buf.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error("Ciphertext too short");
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const key = deriveKey(salt);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      "utf8"
    );
  } catch {
    if (legacyPlaintextPattern?.test(stored)) {
      return stored;
    }
    throw new Error("Failed to decrypt stored value");
  }
}

/** Encrypts a LinkupAPI account_id for storage (AES-256-GCM, key derived from SECRET). */
export function encryptAccountId(plainText) {
  return encryptWithSalt(plainText, SCRYPT_SALT_LINKUP);
}

/** Decrypts a stored LinkupAPI account_id. Supports legacy plaintext rows. */
export function decryptAccountId(stored) {
  try {
    return decryptWithSalt(stored, SCRYPT_SALT_LINKUP, /^[a-f0-9]{24}$/i);
  } catch {
    throw new Error("Failed to decrypt LinkupAPI account id");
  }
}

/** Encrypts a Smartlead email account id for storage. */
export function encryptSmartleadAccountId(plainText) {
  return encryptWithSalt(String(plainText), SCRYPT_SALT_SMARTLEAD);
}

/** Decrypts a stored Smartlead email account id. Supports legacy plaintext numeric ids. */
export function decryptSmartleadAccountId(stored) {
  try {
    return decryptWithSalt(stored, SCRYPT_SALT_SMARTLEAD, /^\d+$/);
  } catch {
    throw new Error("Failed to decrypt Smartlead account id");
  }
}

/** Encrypts a WhatsApp access token or Interakt API key for storage. */
export function encryptWhatsAppToken(plainText) {
  return encryptWithSalt(String(plainText), SCRYPT_SALT_WHATSAPP);
}

/** Decrypts a stored WhatsApp credential. */
export function decryptWhatsAppToken(stored) {
  try {
    return decryptWithSalt(stored, SCRYPT_SALT_WHATSAPP, /^EAA[A-Za-z0-9]+$/);
  } catch {
    throw new Error("Failed to decrypt WhatsApp credential");
  }
}

/** Encrypts a Calendly OAuth access or refresh token for storage. */
export function encryptCalendlyToken(plainText) {
  return encryptWithSalt(String(plainText), SCRYPT_SALT_CALENDLY);
}

/** Decrypts a stored Calendly OAuth token. */
export function decryptCalendlyToken(stored) {
  try {
    return decryptWithSalt(stored, SCRYPT_SALT_CALENDLY, /^[A-Za-z0-9._-]{20,}$/);
  } catch {
    throw new Error("Failed to decrypt Calendly credential");
  }
}

/** Encrypts a HubSpot Private App token or OAuth access/refresh token for storage. */
export function encryptHubSpotToken(plainText) {
  return encryptWithSalt(String(plainText), SCRYPT_SALT_HUBSPOT);
}

/** Decrypts a stored HubSpot credential. Supports legacy plaintext PAT rows. */
export function decryptHubSpotToken(stored) {
  try {
    return decryptWithSalt(stored, SCRYPT_SALT_HUBSPOT, /^pat-[a-z0-9-]+$/i);
  } catch {
    throw new Error("Failed to decrypt HubSpot credential");
  }
}

/** Encrypts webhook signing secrets and verify tokens for storage. */
export function encryptWebhookSecret(plainText) {
  return encryptWithSalt(String(plainText), SCRYPT_SALT_WEBHOOK);
}

/** Decrypts a stored webhook secret. */
export function decryptWebhookSecret(stored) {
  try {
    return decryptWithSalt(stored, SCRYPT_SALT_WEBHOOK, /^.{8,}$/);
  } catch {
    throw new Error("Failed to decrypt webhook secret");
  }
}
