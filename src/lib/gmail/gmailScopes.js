/** Gmail API send scope — https://www.googleapis.com/auth/gmail.send */
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

/** Scopes requested during Google OAuth (openid + profile email + send). */
export const GMAIL_SCOPES = ["openid", "email", GMAIL_SEND_SCOPE];
