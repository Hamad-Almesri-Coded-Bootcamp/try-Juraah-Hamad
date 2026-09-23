/**
 * POST /api/messaging/telegram/webhook/{secret} — the Telegram bot's webhook (API-SURFACE §B, P2-WP6).
 *
 * The path secret is a prefix of sha256(JURAH_BOT_TOKEN) (lib/messaging/telegram.ts); the token
 * itself never appears in the repository. A wrong secret — and EVERY secret while no bot token is
 * configured — is 404 with an empty body.
 *
 * A valid update whose text is `/start <token>` connects the one pending, unexpired messaging
 * link that minted that token (single use — the token is cleared), and only when a caregiver
 * subject is still `active`. Anything else — a used, expired, unknown or foreign token, another
 * command, free text, a malformed body — writes nothing. The response is the same neutral 200
 * in every case, so the webhook never tells anyone whether a token was valid. The chat id is
 * stored server-side and never returned (rule 7). Only POST is exported.
 */
import { selectedBackend } from '@/lib/db/client';
import { connectMessagingLinkByToken } from '@/lib/data/pg/channels';
import { isWebhookSecret, startUpdateOf } from '@/lib/messaging/telegram';

export async function POST(request: Request, { params }: { params: Promise<{ secret: string }> }): Promise<Response> {
  const { secret } = await params;
  if (!isWebhookSecret(secret)) return new Response(null, { status: 404 });
  let update: unknown = null;
  try {
    update = await request.json();
  } catch {
    update = null;
  }
  const start = startUpdateOf(update);
  // The mock backend holds no link store a bot could confirm; there the update is acknowledged
  // and nothing is written (the mock's own startMessagingLink confirms itself — D-12).
  if (start && selectedBackend() === 'postgres') await connectMessagingLinkByToken(start.token, start.chatId);
  return Response.json({ ok: true });
}
