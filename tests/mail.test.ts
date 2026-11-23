import { describe, expect, it } from "vitest";
import { firstMailAsk, firstMailOffer, followupMail, lastMail, landingLink, nicheToCalc, pickSubject, renderMail, shortName, wordCount, type MailContext } from "@/lib/crm/mail/copy";
import { offerSubject } from "@/lib/crm/mail/offer";
import { batchSize, dueStep, effectiveDailyLimit, isSendWindow, planBatch, runsLeftToday, warsawClock } from "@/lib/crm/mail/plan";
import { classify, excerptOf, extractEmails, isOptOut, ownLines } from "@/lib/crm/mail/inbox";
import { isSendableEmail, normalizeNiche, parseContactLines } from "@/lib/crm/mail/parse";
import type { CrmMailRow, CrmMailSettings } from "@/lib/crm/mail/types";

const ctx: MailContext = {
  name: "Pizzeria Rykowisko",
  city: "Lublin",
  niche: "pizza",
  senderName: "Adam Kondracki",
  senderEmail: "adam@skrzynka.pl",
  phone: "500 000 000",
  unsubscribeUrl: "https://sztab.example/api/mail/wypisz?e=x&t=y",
};

function row(over: Partial<CrmMailRow>): CrmMailRow {
  return {
    id: over.email ?? "id",
    email: "kontakt@lokal.pl",
    domain: "lokal.pl",
    name: "Lokal",
    city: "Lublin",
    niche: "pizza",
    www: null,
    instagram: null,
    phone: null,
    source: "csv",
    campaign: "mail-2026-11",
    status: "oczekuje",
    step: 0,
    subject: null,
    mailbox: null,
    message_id: null,
    sent_at: null,
    step2_at: null,
    step3_at: null,
    last_step_at: null,
    replied_at: null,
    reply_excerpt: null,
    bounced_at: null,
    unsubscribed_at: null,
    last_error: null,
    attempts: 0,
    note: null,
    lead_id: null,
    created_at: "2026-11-10T08:00:00Z",
    updated_at: "2026-11-10T08:00:00Z",
    ...over,
  };
}

const settings: CrmMailSettings = {
  id: 1,
  paused: false,
  daily_limit: 150,
  warmup_start: null,
  warmup_start_limit: 20,
  warmup_step: 10,
  followup_after_days: 3,
  last_after_days: 7,
  send_from_hour: 8,
  send_to_hour: 16,
  weekdays_only: true,
  variant: "pytanie",
  updated_at: "2026-11-17T00:00:00Z",
};

// Wtorek 2026-11-17, 10:00 czasu Warszawy (UTC+1).
const TUE_10 = new Date("2026-11-17T09:00:00Z");

describe("treści maili", () => {
  it("mail #1 (pytanie) jest krótki, bez linku, z nazwą lokalu i słowem KARTA", () => {
    const t = firstMailAsk(ctx);
    const body = t.split("Jeśli nie chcecie")[0];
    expect(wordCount(body)).toBeLessThan(120);
    expect(body).not.toMatch(/https?:\/\//);
    expect(t).toContain("Pizzeria Rykowisko");
    expect(t).toContain("„KARTA”");
    expect(t).toContain(ctx.unsubscribeUrl);
  });
  it("lokal z Lublina dostaje 'piszę z Lublina', spoza nie", () => {
    expect(firstMailAsk(ctx)).toContain("piszę z Lublina");
    expect(firstMailAsk({ ...ctx, city: "Warszawa" })).not.toContain("piszę z Lublina");
  });
  it("wariant oferta ma link na /restauracje z nazwą i branżą", () => {
    expect(firstMailOffer(ctx)).toContain("scanova.tech/restauracje?l=Pizzeria+Rykowisko&b=pizzeria");
  });
  it("follow-up bez linku, ostatni z linkiem", () => {
    expect(followupMail(ctx).split("Jeśli nie chcecie")[0]).not.toMatch(/https?:\/\//);
    expect(lastMail(ctx)).toContain("scanova.tech/restauracje");
  });
  it("wariant oferta: HTML Adama z podpisem nadawcy, mailto na skrzynkę i stopką wypisania", () => {
    const r = renderMail(1, "oferta", ctx, offerSubject(ctx.name));
    expect(r.subject).toBe("Karta lojalnościowa dla Rykowisko: pierwsze 14 dni za darmo");
    expect(r.html).toBeDefined();
    // Podpis Adama zostaje nietknięty.
    expect(r.html).toContain("Oliwier Kępa i Adam Kondracki");
    expect(r.html).not.toContain("Adam Kondracki i Adam Kondracki");
    expect(r.html).not.toContain("scanova.support@gmail.com");
    expect(r.html).toContain("mailto:adam@skrzynka.pl");
    // W HTML & w adresie jest zakodowane jako &amp; (przeglądarka odkodowuje).
    expect(r.html).toContain(ctx.unsubscribeUrl.replace("&", "&amp;"));
    expect(r.html!.endsWith("</div>")).toBe(true);
    expect(r.html!.indexOf("kliknąć tutaj")).toBeLessThan(r.html!.lastIndexOf("</td>"));
    expect(r.text).toContain("Pierwsze 14 dni za darmo");
    expect(r.text).not.toContain("[image:");
    expect(r.text).toContain(ctx.unsubscribeUrl);
    expect(renderMail(2, "oferta", ctx, "x").text).toContain("10 minut");
    expect(renderMail(3, "oferta", ctx, "x").text).toContain("scanova.tech/oferta");
    expect(renderMail(2, "oferta", ctx, "x").html).toBeUndefined();
  });
  it("krok 2 i 3 idą jako Re: tematu maila #1", () => {
    expect(renderMail(2, "pytanie", ctx, "pytanie o Rykowisko").subject).toBe("Re: pytanie o Rykowisko");
    expect(renderMail(3, "pytanie", ctx, "Re: x").subject).toBe("Re: x");
    expect(renderMail(1, "pytanie", ctx, "pytanie o Rykowisko").subject).toBe("pytanie o Rykowisko");
  });
  it("temat: krótka nazwa, rotacja stabilna po ziarnie", () => {
    expect(shortName("Restauracja Akuku")).toBe("Akuku");
    expect(shortName("Pizzeria Rykowisko")).toBe("Rykowisko");
    expect(pickSubject("Lokal", "abc")).toBe(pickSubject("Lokal", "abc"));
    expect(pickSubject("Lokal", "abc")).toContain("Lokal");
  });
  it("nisza → parametr kalkulatora", () => {
    expect(nicheToCalc("sushi/azja")).toBe("sushi");
    expect(nicheToCalc("restauracja")).toBeNull();
    expect(landingLink("A & B", "vegan")).toBe("https://scanova.tech/restauracje?l=A+%26+B");
  });
});

describe("plan wysyłki", () => {
  it("okno: wtorek 10:00 tak, sobota nie, 17:00 nie", () => {
    expect(isSendWindow(settings, TUE_10)).toBe(true);
    expect(isSendWindow(settings, new Date("2026-11-21T09:00:00Z"))).toBe(false);
    expect(isSendWindow(settings, new Date("2026-11-17T16:00:00Z"))).toBe(false);
    expect(warsawClock(TUE_10)).toMatchObject({ hour: 10, weekday: 2 });
  });
  it("rozgrzewka rośnie o krok dziennie do limitu", () => {
    const s = { ...settings, warmup_start: "2026-11-17" };
    expect(effectiveDailyLimit(s, "2026-11-16")).toBe(0);
    expect(effectiveDailyLimit(s, "2026-11-17")).toBe(20);
    expect(effectiveDailyLimit(s, "2026-11-20")).toBe(50);
    expect(effectiveDailyLimit(s, "2026-12-30")).toBe(150);
    expect(effectiveDailyLimit(settings, "2026-11-17")).toBe(150);
  });
  it("partia = reszta dnia podzielona na uruchomienia", () => {
    expect(runsLeftToday(settings, TUE_10, 15)).toBe(24);
    expect(batchSize(150, 24)).toBe(7);
    expect(batchSize(0, 24)).toBe(0);
    expect(batchSize(3, 0)).toBe(0);
  });
  it("dueStep: nowy → 1, po 3 dniach → 2, po 7 → 3, błąd ponawia krok", () => {
    expect(dueStep(row({}), settings, "2026-11-17")).toBe(1);
    expect(dueStep(row({ status: "wyslany", step: 1, sent_at: "2026-11-14T10:00:00Z" }), settings, "2026-11-17")).toBe(2);
    expect(dueStep(row({ status: "wyslany", step: 1, sent_at: "2026-11-15T10:00:00Z" }), settings, "2026-11-17")).toBeNull();
    expect(dueStep(row({ status: "followup", step: 2, sent_at: "2026-11-10T10:00:00Z" }), settings, "2026-11-17")).toBe(3);
    expect(dueStep(row({ status: "blad", step: 1, attempts: 1 }), settings, "2026-11-17")).toBe(2);
    expect(dueStep(row({ status: "blad", step: 0, attempts: 3 }), settings, "2026-11-17")).toBeNull();
    expect(dueStep(row({ status: "odpowiedzial" }), settings, "2026-11-17")).toBeNull();
  });
  it("planBatch: follow-upy pierwsze, z tej samej skrzynki; jeden mail na domenę dziennie", () => {
    const rows = [
      row({ email: "a@a.pl", domain: "a.pl", created_at: "2026-11-01T00:00:00Z" }),
      row({ email: "b@a.pl", domain: "a.pl", created_at: "2026-11-02T00:00:00Z" }),
      row({ email: "c@c.pl", domain: "c.pl", status: "wyslany", step: 1, mailbox: "m2@s.pl", sent_at: "2026-11-10T10:00:00Z", created_at: "2026-11-03T00:00:00Z" }),
      row({ email: "d@d.pl", domain: "d.pl", created_at: "2026-11-04T00:00:00Z" }),
    ];
    const plan = planBatch({
      rows,
      settings,
      now: TUE_10,
      sentToday: 0,
      sentTodayByMailbox: {},
      domainsToday: new Set(),
      mailboxes: [
        { email: "m1@s.pl", name: "A", dailyCap: 40 },
        { email: "m2@s.pl", name: "A", dailyCap: 40 },
      ],
      cronMinutes: 15,
    });
    expect(plan[0]).toMatchObject({ step: 2, mailbox: "m2@s.pl" });
    const emails = plan.map((p) => p.row.email);
    expect(emails).toContain("a@a.pl");
    expect(emails).not.toContain("b@a.pl");
    expect(emails).toContain("d@d.pl");
  });
  it("planBatch: pauza, limit wyczerpany, brak skrzynek → nic", () => {
    const rows = [row({})];
    const base = { rows, now: TUE_10, sentToday: 0, sentTodayByMailbox: {}, domainsToday: new Set<string>(), mailboxes: [{ email: "m@s.pl", name: "A", dailyCap: 40 }], cronMinutes: 15 };
    expect(planBatch({ ...base, settings: { ...settings, paused: true } })).toEqual([]);
    expect(planBatch({ ...base, settings, sentToday: 150 })).toEqual([]);
    expect(planBatch({ ...base, settings, mailboxes: [] })).toEqual([]);
    expect(planBatch({ ...base, settings, sentTodayByMailbox: { "m@s.pl": 40 } })).toEqual([]);
    expect(planBatch({ ...base, settings })).toHaveLength(1);
  });
});

describe("skrzynka: klasyfikacja", () => {
  const known = new Set(["kontakt@lokal.pl"]);
  const base = { inReplyTo: null, references: [], autoSubmitted: false, date: null };
  it("odbicie z mailer-daemon wskazuje adresata z treści", () => {
    const c = classify({ ...base, from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>", subject: "Delivery Status Notification (Failure)", text: "Address not found: kontakt@lokal.pl" }, known);
    expect(c).toEqual({ kind: "bounce", recipient: "kontakt@lokal.pl" });
  });
  it("autoodpowiedź po nagłówku i po temacie", () => {
    expect(classify({ ...base, from: "a@b.pl", subject: "Re: x", text: "ok", autoSubmitted: true }, known).kind).toBe("autoreply");
    expect(classify({ ...base, from: "a@b.pl", subject: "Automatyczna odpowiedź: pytanie", text: "Jestem poza biurem" }, known).kind).toBe("autoreply");
  });
  it("'nie' i 'proszę nie pisać' = wypisanie; 'KARTA' = odpowiedź", () => {
    expect(isOptOut("Nie, dziękuję")).toBe(true);
    expect(isOptOut("Proszę nie pisać więcej.\n\n> cytat")).toBe(true);
    expect(isOptOut("KARTA")).toBe(false);
    expect(isOptOut("Tak, chętnie, proszę o więcej informacji. Nie wiem tylko kiedy.")).toBe(false);
    expect(classify({ ...base, from: "Jan <kontakt@lokal.pl>", subject: "Re: pytanie", text: "KARTA\n\nOn Mon, Adam wrote:\n> treść" }, known)).toEqual({ kind: "reply", excerpt: "KARTA" });
  });
  it("ownLines ucina cytat", () => {
    expect(ownLines("Tak\n\nW dniu 17.11.2026 Adam napisał(a):\n> hej")).toBe("Tak");
    expect(excerptOf("Dzień dobry,\nchętnie.\n> stare")).toBe("Dzień dobry, chętnie.");
    expect(extractEmails("x a@b.pl, A@B.PL c@d.com")).toEqual(["a@b.pl", "c@d.com"]);
  });
});

describe("parser list adresów", () => {
  it("linie z | i sam adres", () => {
    const r = parseContactLines("kontakt@pizzalover.pl | Pizza Lover | Lublin | pizza | pizzalover.pl\nbiuro@kawa.pl\nzle-linia");
    expect(r.contacts).toHaveLength(2);
    expect(r.contacts[0]).toMatchObject({ email: "kontakt@pizzalover.pl", name: "Pizza Lover", city: "Lublin", niche: "pizza", www: "https://pizzalover.pl" });
    expect(r.contacts[1]).toMatchObject({ email: "biuro@kawa.pl", name: "kawa.pl", niche: "restauracja" });
    expect(r.errors).toHaveLength(1);
  });
  it("CSV z research (kontakty.csv)", () => {
    const csv = '"instagram","nazwa","miasto","email","email_status","telefon","www"\n"akuku","Restauracja Akuku","Kazimierz Dolny","biuro@akuku.pl","OK","534 233 303","https://akuku.pl"\n"x","Bez maila","Lublin","","BRAK","",""';
    const r = parseContactLines(csv);
    expect(r.contacts).toHaveLength(1);
    expect(r.contacts[0]).toMatchObject({ email: "biuro@akuku.pl", name: "Restauracja Akuku", instagram: "akuku", phone: "+48534233303" });
  });
  it("odrzuca adresy portali i techniczne", () => {
    expect(isSendableEmail("noreply@lokal.pl")).toBe(false);
    expect(isSendableEmail("x@pyszne.pl")).toBe(false);
    expect(isSendableEmail("logo@2x.png")).toBe(false);
    expect(isSendableEmail("kontakt@lokal.pl")).toBe(true);
    expect(normalizeNiche("Pizzeria")).toBe("pizza");
    expect(normalizeNiche("Coffee shop")).toBe("kawiarnia");
    expect(normalizeNiche("")).toBe("restauracja");
  });
});
