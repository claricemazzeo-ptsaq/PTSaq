import { google } from "googleapis";
import { env } from "../env.js";

/**
 * Corporate Google Sign-In (OAuth 2.0), restricted to the org's Workspace
 * domain via the `hd` param. Inert until GOOGLE_OAUTH_CLIENT_ID/SECRET are
 * set — routes/auth.ts checks env.google.enabled before wiring these up.
 */
export function oauthClient(redirectUri: string) {
  return new google.auth.OAuth2(env.google.clientId, env.google.clientSecret, redirectUri);
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const client = oauthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    hd: env.google.allowedDomain || undefined,
    state,
  });
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  hd?: string;
}

export async function exchangeCodeForIdentity(redirectUri: string, code: string): Promise<GoogleIdentity> {
  const client = oauthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new Error("Google did not return an id_token");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.google.clientId });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub) throw new Error("Google id_token missing email/sub");
  if (env.google.allowedDomain && payload.hd !== env.google.allowedDomain) {
    throw new Error(`account is outside the ${env.google.allowedDomain} domain`);
  }
  return { sub: payload.sub, email: payload.email, name: payload.name || payload.email, hd: payload.hd };
}
