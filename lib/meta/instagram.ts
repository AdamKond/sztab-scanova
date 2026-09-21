import "server-only";

// Instagram Messaging (Meta Graph API, wariant "Instagram API with Instagram Login").
//
// Zmienne środowiskowe (Vercel → Settings → Environment Variables):
//   META_VERIFY_TOKEN     — dowolny sekret; ten sam wpisujesz w Meta przy dodawaniu webhooka
//   META_APP_SECRET       — App Secret z panelu aplikacji (do weryfikacji podpisu webhooka)
//   META_IG_ACCESS_TOKEN  — długoterminowy token konta Instagram (60 dni, odświeżany)
//   META_IG_USER_ID       — ID konta Instagram Scanovy (z tokenu / panelu)
//   META_AUTO_REPLY       — "1" = bot odpisuje sam na pierwszą wiadomość (wymaga NEXT_PUBLIC_FILM_URL)
//
// Bez kompletu zmiennych moduł działa "na sucho": webhook przyjmuje zdarzenia,
// zapisuje je w Sztabie, ale nie pyta Meta o nazwę użytkownika i nic nie wysyła.

export { parseWebhook, verifySignature, type InboundMessage } from "./webhook";

const GRAPH = "https://graph.instagram.com/v21.0";

export function metaConfig() {
  const env = (k: string) => process.env[k]?.trim() || null;
  return {
    verifyToken: env("META_VERIFY_TOKEN"),
    appSecret: env("META_APP_SECRET"),
    accessToken: env("META_IG_ACCESS_TOKEN"),
    igUserId: env("META_IG_USER_ID"),
    autoReply: env("META_AUTO_REPLY") === "1",
  };
}

/** Nazwa profilu nadawcy po jego IGSID. null = brak tokenu albo Meta odmówiło. */
export async function fetchUsername(igsid: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${igsid}?fields=username&access_token=${encodeURIComponent(accessToken)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { username?: string };
    return data.username?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Wysyła wiadomość tekstową do nadawcy (dozwolone w oknie 24 h od jego wiadomości). */
export async function sendMessage(
  igUserId: string,
  recipientId: string,
  text: string,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${GRAPH}/${igUserId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `${res.status}: ${body.slice(0, 300)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
