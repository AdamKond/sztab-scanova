// Wersja C „pip”, przebudowana 2026-10-14 wg uwag Adama: jedna rzecz na ekranie naraz, wszystko wyśrodkowane,
// krótkie ujęcia z przejściami, każde ujęcie zaczyna się na konkretnym słowie z transkrypcji.
// Generuje: compositions/c/<ujecie>.html (sub-kompozycje 1080×1300) oraz ../rolka-scanova-c/index.html.
// Uruchom po zmianie timing.json albo tego pliku:  node scripts/build-c.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const T = JSON.parse(readFileSync(path.join(ROOT, "timing.json"), "utf8"));
const W = 1080, H = 1920, DUR = T.video.duration;
const STAGE_H = 1300; // scena ujęć: 0–1300; napisy 1330–1460; Adam 1500–1860
const r2 = (n) => Math.round(n * 100) / 100;

const norm = (x) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
function at(phrase) {
  const ws = (T.captions || []).map((w) => norm(w.w));
  const joined = ws.join(" ");
  const i = joined.indexOf(norm(phrase));
  if (i < 0) throw new Error(`Nie ma w transkrypcji: „${phrase}”`);
  const wi = i > 0 ? joined.slice(0, i).trim().split(" ").length : 0;
  return T.captions[wi].s;
}

// ---------- wspólny styl ujęć ----------
const CSS = `
  #root { position: absolute; inset: 0; overflow: hidden; background: transparent; color: #1c1c1c; font-family: Montserrat, sans-serif; }
  .stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 36px; padding: 80px 90px; box-sizing: border-box; text-align: center; }
  .kicker { font-family: "Space Mono", monospace; font-weight: 700; font-size: 28px; letter-spacing: .14em; text-transform: uppercase; color: #5d5d62; }
  .h { font-weight: 900; font-size: 98px; line-height: 1.04; letter-spacing: -.03em; max-width: 900px; }
  .h em { font-style: normal; color: #1d5fd1; }
  .big { font-weight: 900; font-size: 310px; line-height: .95; letter-spacing: -.05em; font-variant-numeric: tabular-nums; }
  .big.g { color: #1f8f3e; } .big.b { color: #1d5fd1; }
  .sub { font-weight: 700; font-size: 52px; line-height: 1.2; max-width: 800px; color: #1c1c1c; }
  .mono { font-family: "Space Mono", monospace; font-weight: 700; font-size: 34px; color: #5d5d62; }
  .phone { width: 620px; aspect-ratio: 900 / 1272; border-radius: 48px; overflow: hidden; box-shadow: 0 30px 70px rgba(0,0,0,.22); background: #fff; }
  .phone img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .chips { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; }
  .chip { font-family: "Space Mono", monospace; font-weight: 700; font-size: 38px; background: #1c1c1c; color: #fff; border-radius: 999px; padding: 22px 42px; }
  .chip.off { background: #fff; color: #1c1c1c; border: 4px solid #1c1c1c; text-decoration: line-through; text-decoration-color: #d2262e; text-decoration-thickness: 6px; }
  .sticky { background: #fff4a8; font-weight: 900; font-size: 84px; letter-spacing: -.02em; padding: 30px 48px; box-shadow: 8px 12px 24px rgba(0,0,0,.14); max-width: 880px; line-height: 1.1; }
  .card { background: #fff; border: 6px solid #1c1c1c; border-radius: 36px; padding: 40px 48px; box-shadow: 12px 16px 0 rgba(0,0,0,.08); max-width: 880px; box-sizing: border-box; }
  .stars { display: flex; gap: 10px; justify-content: center; }
  .stars span { font-size: 92px; color: #d9d9d4; display: inline-block; line-height: 1; }
  .stars.gold span { color: #b08e30; }
  .avatars { display: flex; justify-content: center; }
  .avatars i { width: 128px; height: 128px; border-radius: 50%; border: 8px solid #fcfcfa; margin-left: -34px; display: grid; place-items: center; font-style: normal; font-weight: 700; font-size: 40px; color: #fff; }
  .avatars i:first-child { margin-left: 0; }
  .list { display: flex; flex-direction: column; gap: 22px; align-items: flex-start; }
  .list div { display: flex; align-items: center; gap: 22px; font-weight: 700; font-size: 58px; }
  .list div i { width: 64px; height: 64px; border-radius: 50%; background: #1f8f3e; color: #fff; display: grid; place-items: center; font-style: normal; font-size: 36px; flex: none; }
  .lock { width: 700px; height: 700px; border-radius: 64px; background: radial-gradient(circle at 30% 20%, #4b6cb7, #182848); box-shadow: 0 30px 70px rgba(0,0,0,.25); position: relative; overflow: hidden; }
  .lock .time { position: absolute; left: 0; right: 0; top: 80px; text-align: center; color: #fff; font-weight: 700; font-size: 150px; letter-spacing: -.03em; }
  .lock .date { position: absolute; left: 0; right: 0; top: 250px; text-align: center; color: rgba(255,255,255,.8); font-family: "Space Mono", monospace; font-size: 28px; }
  .lock .push { position: absolute; left: 44px; right: 44px; top: 360px; border-radius: 30px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,.35); }
  .lock .push img { width: 100%; display: block; }
  .map { width: 780px; height: 780px; border-radius: 50%; background: #eef1f7; position: relative; background-image: linear-gradient(#dfe4ee 2px, transparent 2px), linear-gradient(90deg, #dfe4ee 2px, transparent 2px); background-size: 88px 88px; overflow: hidden; }
  .map .ring { position: absolute; left: 50%; top: 50%; width: 500px; height: 500px; margin: -250px 0 0 -250px; border-radius: 50%; border: 7px dashed #1f8f3e; background: rgba(31,143,62,.09); }
  .map .km { position: absolute; left: 50%; top: 50%; margin: -292px 0 0 -62px; font-family: "Space Mono", monospace; font-weight: 700; font-size: 32px; color: #1f8f3e; background: #fff; padding: 6px 18px; border-radius: 999px; }
  .map .pin { position: absolute; left: 50%; top: 50%; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 50% 50% 50% 0; background: #d2262e; transform: rotate(-45deg); }
  .map .client { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; background: #1d5fd1; border: 6px solid #fff; box-shadow: 0 8px 20px rgba(0,0,0,.25); }
  .notif { background: #fff; border: 6px solid #1c1c1c; border-radius: 30px; padding: 26px 32px; display: flex; gap: 24px; align-items: center; box-shadow: 0 16px 40px rgba(0,0,0,.18); max-width: 820px; text-align: left; }
  .notif i { width: 76px; height: 76px; border-radius: 20px; background: #1d5fd1; flex: none; }
  .notif b { font-size: 42px; display: block; } .notif span { font-size: 36px; color: #5d5d62; }
  .meet { display: flex; align-items: center; gap: 26px; }
  .meet i { width: 90px; height: 90px; border-radius: 22px; background: conic-gradient(#00832d 0 25%, #0066da 0 50%, #e94235 0 75%, #ffba00 0); flex: none; }
  .meet b { font-size: 56px; display: block; text-align: left; } .meet span { font-family: "Space Mono", monospace; font-size: 34px; color: #5d5d62; display: block; text-align: left; }
  .ycard { width: 520px; aspect-ratio: 900 / 1272; border-radius: 44px; overflow: hidden; box-shadow: 0 30px 70px rgba(0,0,0,.22); background: #1d5fd1; color: #fff; text-align: left; }
  .ycard .top { height: 16%; background: rgba(0,0,0,.18); display: flex; align-items: center; padding: 0 7%; font-weight: 700; font-size: 34px; gap: 6%; }
  .ycard .top i { width: 18%; aspect-ratio: 1; background: #fff; border-radius: 14%; }
  .ycard .img { height: 36%; background: linear-gradient(135deg, rgba(255,255,255,.35), rgba(255,255,255,.05)); position: relative; }
  .ycard .img span { position: absolute; left: 10%; top: 30%; width: 14%; aspect-ratio: 1; border-radius: 50%; background: #fff; opacity: .9; }
  .ycard .img span:nth-child(2) { left: 30%; } .ycard .img span:nth-child(3) { left: 50%; } .ycard .img span:nth-child(4) { left: 70%; opacity: .35; }
  .ycard .nag { padding: 8% 7%; } .ycard .nag small { display: block; font-family: "Space Mono", monospace; font-size: 24px; opacity: .8; } .ycard .nag b { font-size: 42px; }
  .bubble { background: #1d5fd1; color: #fff; font-weight: 700; font-size: 64px; padding: 34px 48px; border-radius: 40px 40px 40px 10px; max-width: 860px; text-align: left; }
  .bubble span { display: inline-block; }
  .qr { width: 480px; height: 480px; background: #fff; border: 10px solid #1c1c1c; border-radius: 36px; display: grid; place-items: center; }
  .qr svg { width: 74%; height: 74%; }
  .logo { font-weight: 900; font-size: 150px; letter-spacing: -.05em; }
  .logo small { display: block; font-family: "Space Mono", monospace; font-weight: 400; font-size: 34px; color: #5d5d62; letter-spacing: 0; margin-top: 8px; }
  .plus { background: #1f8f3e; color: #fff; font-weight: 900; font-size: 130px; border-radius: 999px; padding: 20px 56px; box-shadow: 0 20px 50px rgba(31,143,62,.35); }
  .row { display: flex; align-items: center; justify-content: center; gap: 40px; }
`;

const QR_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="#1c1c1c"><rect x="6" y="6" width="30" height="30"/><rect x="64" y="6" width="30" height="30"/><rect x="6" y="64" width="30" height="30"/><rect x="44" y="6" width="8" height="8"/><rect x="44" y="22" width="8" height="8"/><rect x="44" y="44" width="12" height="12"/><rect x="64" y="44" width="8" height="8"/><rect x="80" y="44" width="14" height="8"/><rect x="44" y="64" width="8" height="12"/><rect x="60" y="60" width="8" height="8"/><rect x="76" y="64" width="18" height="8"/><rect x="60" y="80" width="12" height="14"/><rect x="80" y="80" width="14" height="14"/></g><g fill="#fff"><rect x="13" y="13" width="16" height="16"/><rect x="71" y="13" width="16" height="16"/><rect x="13" y="71" width="16" height="16"/></g><g fill="#1c1c1c"><rect x="17" y="17" width="8" height="8"/><rect x="75" y="17" width="8" height="8"/><rect x="17" y="75" width="8" height="8"/></g></svg>`;

// Wejścia ujęć (przejścia): naprzemiennie, żeby montaż „żył”.
const ENTER = {
  up: `tl.fromTo(S, { opacity: 0, y: 90 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }, 0);`,
  right: `tl.fromTo(S, { opacity: 0, x: 140 }, { opacity: 1, x: 0, duration: 0.55, ease: "power3.out" }, 0);`,
  zoom: `tl.fromTo(S, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.4)" }, 0);`,
  down: `tl.fromTo(S, { opacity: 0, y: -90 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }, 0);`,
};
const EXIT = `tl.to(S, { opacity: 0, y: -40, duration: 0.3, ease: "power2.in" }, Math.max(0.6, dur - 0.3));`;

// ---------- ujęcia ----------
// { id, anchor (fraza z transkrypcji), enter, body (HTML wewnątrz .stage), anim (GSAP; dostępne: tl, dur, q(sel)) }
const SHOTS = [
  { id: "c01-klient", anchor: "jeden z naszych", enter: "zoom",
    body: `<div class="kicker" id="c01-k">Jeden z naszych klientów</div><div class="h">Sieć restauracji,<br><em>jeden miesiąc</em></div><div class="mono">prawdziwe liczby z panelu</div>`,
    anim: `` },
  { id: "c02-opinie", anchor: "ponad 300", enter: "up",
    body: `<div class="big g" id="c02-n">+0</div><div class="sub">nowych opinii w Google</div><div class="stars" id="c02-s"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>`,
    anim: `const n = { v: 0 }, el = q("#c02-n");
      tl.to(n, { v: 357, duration: 1.4, ease: "power2.out", onUpdate: () => { el.textContent = "+" + Math.round(n.v); } }, 0.2);
      tl.to("#c02-s span", { color: "#b08e30", duration: 0.2, stagger: 0.1 }, 0.8);` },
  { id: "c03-klienci", anchor: "zbudowal baze", enter: "right",
    body: `<div class="big b" id="c03-n">0</div><div class="sub">stałych klientów</div><div class="avatars" id="c03-a"><i style="background:#1d5fd1">A</i><i style="background:#1f8f3e">M</i><i style="background:#d2262e">K</i><i style="background:#5d5d62">J</i><i style="background:#f4c542;color:#1c1c1c">+</i></div>`,
    anim: `const n = { v: 0 }, el = q("#c03-n");
      tl.to(n, { v: 676, duration: 1.4, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(n.v); } }, 0.2);
      tl.fromTo("#c03-a i", { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)", stagger: 0.1 }, 0.5);` },
  { id: "c04-wracaja", anchor: "ktorzy wracaja", enter: "up",
    body: `<svg width="560" height="360" viewBox="0 0 560 360" aria-hidden="true"><path id="c04-line" d="M30 320 C 160 310, 260 240, 340 150 S 500 40, 530 30" fill="none" stroke="#1f8f3e" stroke-width="16" stroke-linecap="round"/><text x="30" y="352" font-family="Space Mono" font-size="26" fill="#5d5d62">dzień 1</text><text x="420" y="352" font-family="Space Mono" font-size="26" fill="#5d5d62">dzień 30</text></svg><div class="h">Klienci <em>wracają sami</em></div>`,
    anim: `const l = q("#c04-line"); l.style.strokeDasharray = 760; l.style.strokeDashoffset = 760;
      tl.to(l, { strokeDashoffset: 0, duration: 1.3, ease: "power2.inOut" }, 0.2);` },
  { id: "c05-scanova", anchor: "jestesmy scanova", enter: "zoom",
    body: `<div class="logo">Scanova<small>cyfrowe karty lojalnościowe dla lokali</small></div>`,
    anim: `` },
  { id: "c06-qr", anchor: "klient skanuje", enter: "right",
    body: `<div class="h">Klient skanuje <em>kod QR</em> przy kasie</div><div class="qr" id="c06-qr">${QR_SVG}</div>`,
    anim: `tl.fromTo("#c06-qr", { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.8)" }, 0.5);
      tl.fromTo("#c06-qr", { boxShadow: "0 0 0 0 rgba(29,95,209,0.5)" }, { boxShadow: "0 0 0 60px rgba(29,95,209,0)", duration: 1.0, ease: "power2.out" }, 1.2);` },
  { id: "c07-wallet", anchor: "i karta od razu", enter: "up",
    body: `<div class="phone" id="c07-p"><img src="assets/karta-wallet.png" alt="Karta w Wallecie"></div><div class="chips" id="c07-c"><span class="chip">Apple Wallet</span><span class="chip">Google Wallet</span></div>`,
    anim: `tl.fromTo("#c07-p", { y: 300, opacity: 0, rotation: 3 }, { y: 0, opacity: 1, rotation: 0, duration: 0.8, ease: "power3.out" }, 0.1);
      tl.fromTo("#c07-c .chip", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.25 }, 1.6);` },
  { id: "c08-bez", anchor: "bez aplikacji", enter: "zoom",
    body: `<div class="h">Bez…</div><div class="chips" style="flex-direction:column;gap:26px" id="c08-c"><span class="chip off">aplikacji</span><span class="chip off">rejestracji</span><span class="chip off">pobierania</span></div>`,
    anim: `tl.fromTo("#c08-c .chip", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out", stagger: 0.75 }, 0.3);` },
  { id: "c09-pieczatka", anchor: "za kazda wizyte", enter: "right",
    body: `<div class="h">Każda wizyta = <em>pieczątka</em></div><div class="row"><div class="phone" style="width:520px" id="c09-p"><img src="assets/pieczatka.png" alt="Pieczątka"></div><div class="plus" id="c09-plus">+1</div></div>`,
    anim: `tl.fromTo("#c09-plus", { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(3)" }, 0.9);` },
  { id: "c10-nagroda", anchor: "po kilku wraca", enter: "up",
    body: `<div class="h">Po kilku: <em>nagroda</em></div><div class="phone" style="width:540px" id="c10-p"><img src="assets/nagroda.png" alt="Nagroda"></div>`,
    anim: `tl.fromTo("#c10-p", { scale: 0.9 }, { scale: 1.04, duration: 0.5, yoyo: true, repeat: 1, ease: "power1.inOut" }, 0.8);` },
  { id: "c11-opinia", anchor: "a po wizycie", enter: "zoom",
    body: `<div class="h">Po wizycie system sam <em>prosi o opinię</em></div><div class="card"><div class="sub" style="margin-bottom:20px">Podobało się?</div><div class="stars" id="c11-s"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div><div class="chip" style="background:#1f8f3e;margin-top:24px;display:inline-block">Zostaw opinię w Google</div></div>`,
    anim: `tl.to("#c11-s span", { color: "#f4c542", duration: 0.2, stagger: 0.15 }, 1.0);` },
  { id: "c12-setki", anchor: "stad te setki", enter: "up",
    body: `<div class="big g" id="c12-n">+300</div><div class="sub">setki opinii w miesiącu</div><div class="stars gold"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>`,
    anim: `const n = { v: 300 }, el = q("#c12-n");
      tl.to(n, { v: 357, duration: 1.2, ease: "power1.out", onUpdate: () => { el.textContent = "+" + Math.round(n.v); } }, 0.2);` },
  { id: "c13-push", anchor: "mozesz tez", enter: "right",
    body: `<div class="h">Powiadomienia <em>push</em> do klientów</div><div class="lock" id="c13-l"><div class="time">12:30</div><div class="date">sobota, 18 października</div><div class="push" id="c13-p"><img src="assets/push.png" alt="Powiadomienie"></div></div>`,
    anim: `tl.fromTo("#c13-p", { opacity: 0, y: -140 }, { opacity: 1, y: 0, duration: 0.7, ease: "back.out(1.6)" }, 0.9);` },
  { id: "c14-promo", anchor: "na przyklad 20", enter: "zoom",
    body: `<div class="sticky" id="c14-s">20% na wszystko w ten weekend</div><div class="mono">wysyłasz jednym kliknięciem</div>`,
    anim: `tl.fromTo("#c14-s", { rotation: -3 }, { rotation: -1.5, duration: 0.6, ease: "power1.out" }, 0);` },
  { id: "c15-automat", anchor: "albo system", enter: "up",
    body: `<div class="h">Albo <em>automat</em></div><div class="map" id="c15-m"><div class="ring" id="c15-r"></div><div class="km">1 km</div><div class="pin" id="c15-pin"></div></div>`,
    anim: `tl.fromTo("#c15-r", { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: "power2.out" }, 0.6);` },
  { id: "c16-klient", anchor: "zalozmy ze klient", enter: "right",
    body: `<div class="h">Klient jest <em>kilometr</em> od lokalu</div><div class="map"><div class="ring"></div><div class="km">1 km</div><div class="pin"></div><div class="client" id="c16-c"></div></div>`,
    anim: `tl.fromTo("#c16-c", { x: 330, y: -230 }, { x: 110, y: -70, duration: 2.0, ease: "power1.inOut" }, 0.3);` },
  { id: "c17-oferta", anchor: "i automatycznie", enter: "zoom",
    body: `<div class="h">…i sam dostaje <em>powiadomienie</em></div><div class="notif" id="c17-n"><i></i><div><b>Twój lokal</b><span>Dziś czeka na Ciebie specjalna oferta 🎉</span></div></div>`,
    anim: `tl.fromTo("#c17-n", { opacity: 0, y: -60 }, { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.6)" }, 0.7);` },
  { id: "c18-system", anchor: "jesli chcesz", enter: "up",
    body: `<div class="kicker">Co dalej</div><div class="h">System ustawiony <em>pod Twoją restaurację</em></div>`,
    anim: `` },
  { id: "c19-meet", anchor: "umowimy sie", enter: "right",
    body: `<div class="card"><div class="meet"><i></i><div><b>Spotkanie online</b><span>Google Meet · ok. 15 minut</span></div></div></div>`,
    anim: `` },
  { id: "c20-ustalimy", anchor: "ustalimy", enter: "zoom",
    body: `<div class="row" style="gap:60px"><div class="ycard" id="c20-card"><div class="top"><i></i>Twój lokal</div><div class="img"><span></span><span></span><span></span><span></span></div><div class="nag"><small>NAGRODA</small><b>Twoja nagroda</b></div></div><div class="list" id="c20-l"><div><i>✓</i>kolorystyka</div><div><i>✓</i>grafika</div><div><i>✓</i>nagroda</div></div></div>`,
    anim: `tl.fromTo("#c20-l div", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out", stagger: 0.6 }, 0.4);
      tl.to("#c20-card", { backgroundColor: "#1f8f3e", duration: 0.5 }, 0.5);
      tl.to("#c20-card", { backgroundColor: "#d2262e", duration: 0.5 }, 1.2);
      tl.to("#c20-card", { backgroundColor: "#1c1c1c", duration: 0.5 }, 1.9);` },
  { id: "c21-jutro", anchor: "juz jutro", enter: "up",
    body: `<div class="kicker">Już jutro</div><div class="h">Twoja karta <em>w portfelu</em> Twoich gości</div><div class="phone" style="width:480px" id="c21-p"><img src="assets/karta-wallet.png" alt="Karta"></div>`,
    anim: `tl.fromTo("#c21-p", { y: 200, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, 0.5);` },
  { id: "c22-14dni", anchor: "pierwsze 14", enter: "zoom",
    body: `<div class="sticky" id="c22-s" style="font-size:96px;max-width:none;white-space:nowrap">Pierwsze 14 dni<br>za darmo</div>`,
    anim: `tl.fromTo("#c22-s", { rotation: -4 }, { rotation: -2, duration: 0.6, ease: "power1.out" }, 0);` },
  { id: "c23-ryzyko", anchor: "wiec nie ryzykujesz", enter: "right",
    body: `<div class="h">Nie ryzykujesz <em>niczym</em></div><div class="chips" style="flex-direction:column;gap:22px" id="c23-c"><span class="chip">bez umowy</span><span class="chip">bez instalacji</span><span class="chip">bez kosztów na start</span></div>`,
    anim: `tl.fromTo("#c23-c .chip", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.35 }, 0.3);` },
  { id: "c24-odpisz", anchor: "wystarczy ze", enter: "up",
    body: `<div class="h">Odpisz na <em>tę wiadomość</em></div><div class="bubble" id="c24-b"><span>chcę</span> <span>poznać</span> <span>szczegóły</span></div>`,
    anim: `tl.fromTo("#c24-b span", { opacity: 0 }, { opacity: 1, duration: 0.15, stagger: 0.35 }, 0.6);` },
  { id: "c25-link", anchor: "a my wyslemy", enter: "zoom",
    body: `<div class="card"><div class="meet"><i></i><div><b>Link do Google Meet</b><span>wysyłamy od razu</span></div></div></div><div class="logo" style="font-size:110px;margin-top:20px">Scanova<small>scanova.tech</small></div>`,
    anim: `` },
];

// czasy ujęć
const starts = SHOTS.map((s) => Math.max(0, r2(at(s.anchor) - 0.12)));
starts[0] = 0;
const shots = SHOTS.map((s, i) => ({ ...s, start: starts[i], end: i + 1 < SHOTS.length ? starts[i + 1] : DUR }));
for (let i = 1; i < shots.length; i++) if (shots[i].start <= shots[i - 1].start) throw new Error(`Kolejność ujęć: ${shots[i].id}`);

// pliki ujęć
mkdirSync(path.join(ROOT, "compositions", "c"), { recursive: true });
for (const s of shots) {
  const html = `<!doctype html>
<html lang="pl" data-composition-variables='[{"id":"dur","type":"number","label":"Długość ujęcia (s)","default":${r2(s.end - s.start)}}]'>
  <head><meta charset="UTF-8" /><title>${s.id}</title></head>
  <body>
    <template>
      <style>${CSS}</style>
      <div id="root" data-composition-id="${s.id}" data-width="${W}" data-height="${STAGE_H}">
        <div class="stage" id="${s.id}-stage">
          ${s.body}
        </div>
      </div>
      <script>
        (function () {
          const vars = (window.__hyperframes && window.__hyperframes.getVariables && window.__hyperframes.getVariables()) || {};
          const dur = Number.isFinite(+vars.dur) && +vars.dur > 0 ? +vars.dur : ${r2(s.end - s.start)};
          const q = (sel) => document.querySelector(sel);
          const S = "#${s.id}-stage";
          const tl = gsap.timeline({ paused: true });
          ${ENTER[s.enter]}
          ${s.anim}
          ${EXIT}
          window.__timelines["${s.id}"] = tl;
        })();
      </script>
    </template>
  </body>
</html>
`;
  writeFileSync(path.join(ROOT, "compositions", "c", `${s.id}.html`), html);
}

// napisy: jedna linia, maks. 4 słowa, w stałej strefie
function lines(words) {
  const out = []; let cur = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (cur.length && (cur.length >= 3 || w.s - prev.e > 0.7 || /[.?!]$/.test(prev.w))) { out.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out;
}
const CAP = lines(T.captions || []);
const capMarkup = CAP.map((ln, i) => `<div class="cap-line" id="cap-l${i}">${ln.map((w, j) => `<span class="cap-w" id="cap-w${i}-${j}">${w.w.replace(/</g, "&lt;")}</span>`).join(" ")}</div>`).join("\n        ");
const capTl = [];
CAP.forEach((ln, i) => {
  const next = CAP[i + 1];
  const s = ln[0].s, e = Math.min(ln[ln.length - 1].e + 0.18, next ? next[0].s - 0.12 : DUR);
  capTl.push(`tl.fromTo("#cap-l${i}", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, ${r2(s)});`);
  capTl.push(`tl.to("#cap-l${i}", { opacity: 0, duration: 0.08 }, ${r2(Math.max(s + 0.2, e))});`);
  ln.forEach((w, j) => capTl.push(`tl.fromTo("#cap-w${i}-${j}", { opacity: 0.55, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.14, ease: "back.out(2)" }, ${r2(w.s)});`));
});

const hosts = shots.map((s) => `<div id="el-${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/c/${s.id}.html" data-start="${r2(s.start)}" data-duration="${r2(s.end - s.start)}" data-track-index="2" data-width="${W}" data-height="${STAGE_H}" data-variable-values='{"dur":${r2(s.end - s.start)}}' style="position:absolute; left:0; top:0; width:${W}px; height:${STAGE_H}px;"></div>`).join("\n      ");

const index = `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>Rolka Scanovy · C pip</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      body { margin: 0; background: #fcfcfa; font-family: Montserrat, sans-serif; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #fcfcfa; }
      /* tło: nie jest klipem, więc samo się pozycjonuje */
      #bg { position: absolute; inset: 0; background: #fcfcfa; }
      #bg i { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55; display: block; }
      #bg .b1 { width: 900px; height: 900px; left: -300px; top: -200px; background: #dbe7ff; }
      #bg .b2 { width: 800px; height: 800px; right: -300px; top: 700px; background: #e3f5e8; }
      #bg .b3 { width: 700px; height: 700px; left: 100px; bottom: -300px; background: #fff3c4; }
      .clip { position: absolute; }
      #adam { position: absolute; left: 360px; top: 1500px; width: 360px; height: 360px; object-fit: cover; border-radius: 48px; border: 8px solid #1c1c1c; box-shadow: 0 24px 60px rgba(0,0,0,.25); z-index: 3; }
      #caps { position: absolute; left: 0; width: 1080px; top: 1330px; height: 140px; pointer-events: none; }
      .cap-line { position: absolute; left: 0; right: 0; top: 0; text-align: center; font-weight: 700; font-size: 60px; line-height: 1.2; color: #1c1c1c; opacity: 0; padding: 0 60px; }
      .cap-w { display: inline-block; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="rolka-c" data-start="0" data-width="${W}" data-height="${H}" data-duration="${r2(DUR)}">
      <div id="bg"><i class="b1" id="bg1"></i><i class="b2" id="bg2"></i><i class="b3" id="bg3"></i></div>
      <video id="adam" class="clip" src="${T.video.pip}" playsinline data-has-audio="true" data-start="0" data-duration="${r2(DUR)}" data-track-index="1" data-volume="1"></video>
      ${hosts}
      <div id="caps" class="clip" data-start="0" data-duration="${r2(DUR)}" data-track-index="5">
        ${capMarkup}
      </div>
    </div>
    <script>
      (function () {
        const tl = gsap.timeline({ paused: true });
        // tło: powolny dryf plam przez cały film (deterministyczny)
        tl.fromTo("#bg1", { x: 0, y: 0 }, { x: 160, y: 120, duration: ${r2(DUR)}, ease: "sine.inOut" }, 0);
        tl.fromTo("#bg2", { x: 0, y: 0 }, { x: -140, y: -160, duration: ${r2(DUR)}, ease: "sine.inOut" }, 0);
        tl.fromTo("#bg3", { x: 0, y: 0 }, { x: 120, y: -80, duration: ${r2(DUR)}, ease: "sine.inOut" }, 0);
        ${capTl.join("\n        ")}
        window.__timelines["rolka-c"] = tl;
      })();
    </script>
  </body>
</html>
`;
writeFileSync(path.join(ROOT, "..", "rolka-scanova-c", "index.html"), index);
console.log(`C: ${shots.length} ujęć · ` + shots.map((s) => `${s.id.slice(0, 3)}@${s.start}`).join(" "));
