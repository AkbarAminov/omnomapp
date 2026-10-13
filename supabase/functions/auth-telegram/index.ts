// Deno Edge Function. Deploy with: supabase functions deploy auth-telegram --no-verify-jwt
// (must be --no-verify-jwt: this endpoint is the one place an unauthenticated client is
// allowed to call, since its whole job is to hand out the first session).
//
// Secrets required (supabase secrets set ...): TELEGRAM_BOT_TOKEN, TG_HASH_SALT.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected automatically
// by the platform — do not set them by hand.
//
// This project's Supabase Auth uses asymmetric (ES256) JWT signing keys (checked against
// <project>/auth/v1/.well-known/jwks.json), so there is no shared secret this function could
// use to self-sign a token. Instead it creates a real auth.users row per Telegram user (via
// the admin API) and mints a session for it through generateLink + verify — both calls are
// performed by Supabase's own Auth server, so they produce a genuinely valid, correctly
// signed session regardless of which signing scheme the project uses.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const HASH_SALT = Deno.env.get('TG_HASH_SALT')!;

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  // supabase-js всегда добавляет authorization/apikey/x-client-info к вызову functions.invoke(),
  // даже для анонимного клиента — без них в Allow-Headers браузер молча режет сам запрос на
  // preflight, а fetch() в клиенте видит это как "Failed to send a request", без статуса.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

async function hmac(keyBytes: Uint8Array, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function verifyInitData(initData: string): Promise<{ id: number; language_code?: string } | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const authDate = Number(params.get('auth_date') ?? '0');
  if (!authDate || Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) return null;

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = await hmac(new TextEncoder().encode('WebAppData'), BOT_TOKEN);
  const computedHash = toHex(await hmac(secretKey, dataCheckString));
  if (computedHash !== hash) return null;

  const userJson = params.get('user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json().catch(() => null);
    const initData = body?.initData;
    if (typeof initData !== 'string' || !initData) return json({ error: 'bad_request' }, 400);

    const tgUser = await verifyInitData(initData);
    if (!tgUser) return json({ error: 'invalid_signature' }, 401);

    // tgUser.id (the real Telegram id) is used once, right here, and never stored or logged.
    const tgHash = toHex(await hmac(new TextEncoder().encode(HASH_SALT), String(tgUser.id)));
    const language = tgUser.language_code ?? null;
    const source = new URLSearchParams(initData).get('start_param') ?? null;
    const syntheticEmail = `${tgHash}@telegram.omnom.internal`;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: existing } = await admin.from('users').select('id').eq('tg_hash', tgHash).maybeSingle();

    let userId: string;
    if (existing) {
      userId = existing.id;
      await admin.from('users').update({ language, last_seen_at: new Date().toISOString() }).eq('id', userId);
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
      });
      if (createErr || !created?.user) return json({ error: 'auth_create_failed' }, 500);
      userId = created.user.id;
      const { error: insertErr } = await admin.from('users').insert({
        id: userId,
        tg_hash: tgHash,
        language,
        source,
        last_seen_at: new Date().toISOString(),
      });
      if (insertErr) return json({ error: 'profile_create_failed' }, 500);
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: syntheticEmail,
    });
    const hashedToken = link?.properties?.hashed_token;
    if (linkErr || !hashedToken) return json({ error: 'session_issue_failed' }, 500);

    const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON_KEY },
      body: JSON.stringify({ type: 'magiclink', token_hash: hashedToken }),
    });
    if (!verifyRes.ok) return json({ error: 'session_issue_failed' }, 500);
    const session = await verifyRes.json();

    return json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      language,
      source,
    });
  } catch {
    return json({ error: 'internal_error' }, 500);
  }
});
