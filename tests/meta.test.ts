import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { parseWebhook, verifySignature } from "@/lib/meta/webhook";

describe("verifySignature", () => {
  const secret = "tajne";
  const body = '{"object":"instagram"}';
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("akceptuje poprawny podpis", () => {
    expect(verifySignature(body, sig, secret)).toBe(true);
  });
  it("odrzuca zły sekret, brak nagłówka i zmienione body", () => {
    expect(verifySignature(body, sig, "inne")).toBe(false);
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body + " ", sig, secret)).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("wyciąga wiadomości tekstowe, pomija echo i zdarzenia bez tekstu", () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          time: 1,
          messaging: [
            { sender: { id: "111" }, recipient: { id: "999" }, timestamp: 5, message: { mid: "m1", text: "ok" } },
            { sender: { id: "999" }, recipient: { id: "111" }, timestamp: 6, message: { mid: "m2", text: "echo", is_echo: true } },
            { sender: { id: "222" }, recipient: { id: "999" }, timestamp: 7, read: { mid: "m1" } },
          ],
        },
      ],
    };
    const msgs = parseWebhook(payload);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ senderId: "111", text: "ok", isEcho: false });
    expect(msgs[1].isEcho).toBe(true);
  });
  it("obcy obiekt daje pustą listę", () => {
    expect(parseWebhook({ object: "page", entry: [] })).toEqual([]);
    expect(parseWebhook(null)).toEqual([]);
  });
});
