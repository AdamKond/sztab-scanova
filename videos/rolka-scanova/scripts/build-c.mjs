// Wersja C „pip” v2 (2026-10-14, po drugiej rundzie uwag Adama): Adam w prawym dolnym rogu, mocniejszy huk na start,
// ujęcia z filmu produktowego scanova.tech (assets/film-scanova.mp4, karta-scanova.mp4, jak-dziala.mp4) jako b-roll,
// nagłówki animowane słowo po słowie, jedna rzecz na ekranie naraz, każde ujęcie startuje na słowie z transkrypcji.
// Generuje: compositions/c/<ujecie>.html (sub-kompozycje 1080×1300) oraz ../rolka-scanova-c/index.html.
// Uruchom po zmianie timing.json albo tego pliku:  node scripts/build-c.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const T = JSON.parse(readFileSync(path.join(ROOT, "timing.json"), "utf8"));
const W = 1080, H = 1920, DUR = T.video.duration;
const STAGE_H = 1300; // ujęcia: 0–1300 · napisy: 1330–1460 · Adam: 1480–1860 (prawy dolny róg)
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
  .stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 34px; padding: 70px 80px; box-sizing: border-box; text-align: center; }
  .kicker { font-family: "Space Mono", monospace; font-weight: 700; font-size: 30px; letter-spacing: .14em; text-transform: uppercase; color: #5d5d62; }
  .h { font-weight: 900; font-size: 96px; line-height: 1.04; letter-spacing: -.03em; max-width: 920px; }
  .h em { font-style: normal; color: #1d5fd1; }
  .h .w { display: inline-block; }
  .big { font-weight: 900; font-size: 330px; line-height: .92; letter-spacing: -.05em; font-variant-numeric: tabular-nums; }
  .big.g { color: #1f8f3e; } .big.b { color: #1d5fd1; }
  .sub { font-weight: 700; font-size: 54px; line-height: 1.2; max-width: 820px; }
  .mono { font-family: "Space Mono", monospace; font-weight: 700; font-size: 34px; color: #5d5d62; }
  .vid { position: relative; overflow: hidden; border-radius: 44px; box-shadow: 0 30px 70px rgba(0,0,0,.18); background: #fff; }
  .vid video { position: absolute; display: block; }
  .vid.dark { background: #0d2a5c; }
  .chips { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; }
  .chip { font-family: "Space Mono", monospace; font-weight: 700; font-size: 38px; background: #1c1c1c; color: #fff; border-radius: 999px; padding: 22px 42px; }
  .chip.off { background: #fff; color: #1c1c1c; border: 4px solid #1c1c1c; position: relative; }
  .chip.off i { position: absolute; left: 8%; right: 8%; top: 50%; height: 8px; margin-top: -4px; background: #d2262e; border-radius: 4px; transform-origin: left center; display: block; }
  .sticky { background: #fff4a8; font-weight: 900; font-size: 84px; letter-spacing: -.02em; padding: 30px 48px; box-shadow: 8px 12px 24px rgba(0,0,0,.14); max-width: 900px; line-height: 1.1; }
  .card { background: #fff; border: 6px solid #1c1c1c; border-radius: 36px; padding: 40px 48px; box-shadow: 12px 16px 0 rgba(0,0,0,.08); max-width: 900px; box-sizing: border-box; }
  .stars { display: flex; gap: 10px; justify-content: center; }
  .stars span { font-size: 96px; color: #d9d9d4; display: inline-block; line-height: 1; }
  .stars.gold span { color: #b08e30; }
  .avatars { display: flex; justify-content: center; }
  .avatars i { width: 130px; height: 130px; border-radius: 50%; border: 8px solid #fcfcfa; margin-left: -34px; display: grid; place-items: center; font-style: normal; font-weight: 700; font-size: 42px; color: #fff; }
  .avatars i:first-child { margin-left: 0; }
  .bars { display: flex; align-items: flex-end; gap: 14px; height: 420px; }
  .bars i { display: block; width: 44px; background: #1d5fd1; border-radius: 12px 12px 4px 4px; transform-origin: bottom center; }
  .notif { background: #fff; border: 6px solid #1c1c1c; border-radius: 30px; padding: 26px 32px; display: flex; gap: 24px; align-items: center; box-shadow: 0 16px 40px rgba(0,0,0,.18); max-width: 860px; text-align: left; }
  .notif i { width: 80px; height: 80px; border-radius: 20px; background: #1d5fd1; flex: none; }
  .notif b { font-size: 42px; display: block; } .notif span { font-size: 36px; color: #5d5d62; }
  .meet { display: flex; align-items: center; gap: 26px; }
  .meet i { width: 92px; height: 92px; border-radius: 22px; background: conic-gradient(#00832d 0 25%, #0066da 0 50%, #e94235 0 75%, #ffba00 0); flex: none; }
  .meet b { font-size: 56px; display: block; text-align: left; } .meet span { font-family: "Space Mono", monospace; font-size: 34px; color: #5d5d62; display: block; text-align: left; }
  .bubble { background: #1d5fd1; color: #fff; font-weight: 700; font-size: 64px; padding: 34px 48px; border-radius: 40px 40px 40px 10px; max-width: 880px; text-align: left; }
  .bubble span { display: inline-block; }
  .logo { font-weight: 900; font-size: 150px; letter-spacing: -.05em; }
  .logo small { display: block; font-family: "Space Mono", monospace; font-weight: 400; font-size: 34px; color: #5d5d62; letter-spacing: 0; margin-top: 8px; }
`;

// b-roll: fragment filmu w prostokącie (wrapper w×h; wideo skalowane do vw×vh i przesunięte o left/top)
function clip({ src, from, w, h, vw, vh, left = 0, top = 0, dark = false, id }) {
  return `<div class="vid${dark ? " dark" : ""}" id="${id}" style="width:${w}px;height:${h}px"><video id="${id}-video" src="${src}" muted playsinline data-start="0" data-duration="DURATION" data-media-start="${from}" data-track-index="1" style="width:${vw}px;height:${vh}px;left:${left}px;top:${top}px"></video></div>`;
}
const FILM = "assets/film-scanova.mp4"; // 1920×1080, białe tło
const KARTA = "assets/karta-scanova.mp4"; // 1000×1120, granatowe tło
const JAK = "assets/jak-dziala.mp4"; // 1400×820, granatowe tło

// wejścia ujęć (przejścia)
const ENTER = {
  up: `tl.fromTo(S, { opacity: 0, y: 110 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }, 0);`,
  right: `tl.fromTo(S, { opacity: 0, x: 160 }, { opacity: 1, x: 0, duration: 0.55, ease: "power3.out" }, 0);`,
  zoom: `tl.fromTo(S, { opacity: 0, scale: 0.84 }, { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.4)" }, 0);`,
  slam: `tl.fromTo(S, { opacity: 0, scale: 1.9 }, { opacity: 1, scale: 1, duration: 0.42, ease: "power4.out" }, 0);
      tl.fromTo(S, { x: 0 }, { x: -10, duration: 0.05, yoyo: true, repeat: 3, ease: "none" }, 0.42);`,
  flip: `tl.fromTo(S, { opacity: 0, rotationX: -40, transformPerspective: 1400, y: 40 }, { opacity: 1, rotationX: 0, y: 0, duration: 0.6, ease: "power3.out" }, 0);`,
};
const EXIT = `tl.to(S, { opacity: 0, y: -50, scale: 0.97, duration: 0.3, ease: "power2.in" }, Math.max(0.6, dur - 0.3));`;
// nagłówki: słowa wjeżdżają po kolei
const WORDS = `document.querySelectorAll(S + " .h").forEach((h) => {
        h.innerHTML = h.innerHTML.split(/(<br\\s*\\/?>)/).map((part) => /^<br/.test(part) ? part : part.replace(/(<em>)?([^<\\s]+)(<\\/em>)?/g, (m, a, w, b) => (a || "") + '<span class="w">' + w + "</span>" + (b || ""))).join("");
        tl.fromTo(h.querySelectorAll(".w"), { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out", stagger: 0.06 }, 0.12);
      });`;

// ---------- ujęcia ----------
const SHOTS = [
  { id: "c01-huk", anchor: "jeden z naszych", enter: "slam",
    body: `<div class="kicker">Jeden z naszych klientów · 1 miesiąc</div><div class="big g" id="c01-n">+357</div><div class="sub">nowych opinii w Google</div><div class="stars" id="c01-s"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>`,
    anim: `const n = { v: 0 }, el = q("#c01-n");
      tl.to(n, { v: 357, duration: 1.1, ease: "power3.out", onUpdate: () => { el.textContent = "+" + Math.round(n.v); } }, 0.1);
      tl.fromTo("#c01-s span", { opacity: 0, scale: 0.2, y: -40 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(3)", stagger: 0.09 }, 0.9);
      tl.to("#c01-s span", { color: "#b08e30", duration: 0.15, stagger: 0.09 }, 1.0);
      tl.fromTo(el, { scale: 1 }, { scale: 1.08, duration: 0.18, yoyo: true, repeat: 1, ease: "power1.inOut" }, 4.0);` },
  { id: "c02-klienci", anchor: "zbudowal baze", enter: "up",
    body: `<div class="big b" id="c02-n">0</div><div class="sub">stałych klientów</div><div class="avatars" id="c02-a"><i style="background:#1d5fd1">A</i><i style="background:#1f8f3e">M</i><i style="background:#d2262e">K</i><i style="background:#5d5d62">J</i><i style="background:#f4c542;color:#1c1c1c">+</i></div>`,
    anim: `const n = { v: 0 }, el = q("#c02-n");
      tl.to(n, { v: 676, duration: 1.2, ease: "power3.out", onUpdate: () => { el.textContent = Math.round(n.v); } }, 0.1);
      tl.fromTo("#c02-a i", { opacity: 0, scale: 0.2, x: 60 }, { opacity: 1, scale: 1, x: 0, duration: 0.45, ease: "back.out(2.2)", stagger: 0.1 }, 0.4);` },
  { id: "c03-wracaja", anchor: "ktorzy wracaja", enter: "right",
    body: `<div class="h">Klienci <em>wracają sami</em></div><div class="bars" id="c03-b"><i style="height:30%"></i><i style="height:38%"></i><i style="height:34%"></i><i style="height:48%"></i><i style="height:56%"></i><i style="height:52%"></i><i style="height:66%"></i><i style="height:72%"></i><i style="height:70%"></i><i style="height:84%"></i><i style="height:92%"></i><i style="height:100%"></i></div><div class="mono">powroty tydzień po tygodniu</div>`,
    anim: `tl.fromTo("#c03-b i", { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: "power3.out", stagger: 0.07 }, 0.3);` },
  { id: "c04-scanova", anchor: "jestesmy scanova", enter: "zoom",
    body: `${clip({ id: "c04-v", src: FILM, from: 38.2, w: 1000, h: 700, vw: 1245, vh: 700, left: -122 })}`,
    anim: `` },
  { id: "c05-qr", anchor: "klient skanuje", enter: "up",
    body: `<div class="h">Klient <em>skanuje</em> przy kasie</div>${clip({ id: "c05-v", src: JAK, from: 0.0, w: 1000, h: 586, vw: 1000, vh: 586, dark: true })}`,
    anim: `` },
  { id: "c06-wallet", anchor: "i karta od razu", enter: "flip",
    body: `${clip({ id: "c06-v", src: FILM, from: 10.3, w: 620, h: 980, vw: 1742, vh: 980, left: -125 })}<div class="chips" id="c06-c"><span class="chip">Apple Wallet</span><span class="chip">Google Wallet</span></div>`,
    anim: `tl.fromTo("#c06-c .chip", { opacity: 0, y: 24, rotation: -4 }, { opacity: 1, y: 0, rotation: 0, duration: 0.45, ease: "back.out(2)", stagger: 0.3 }, 2.2);` },
  { id: "c07-bez", anchor: "bez aplikacji", enter: "zoom",
    body: `<div class="h">Bez…</div><div class="chips" style="flex-direction:column;gap:26px" id="c07-c"><span class="chip off">aplikacji<i></i></span><span class="chip off">rejestracji<i></i></span><span class="chip off">pobierania<i></i></span></div>`,
    anim: `tl.fromTo("#c07-c .chip", { opacity: 0, x: -60, rotation: -6 }, { opacity: 1, x: 0, rotation: 0, duration: 0.45, ease: "back.out(1.8)", stagger: 0.7 }, 0.3);
      tl.fromTo("#c07-c .chip i", { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power3.out", stagger: 0.7 }, 0.75);` },
  { id: "c08-pieczatki", anchor: "za kazda wizyte", enter: "right",
    body: `<div class="h">Każda wizyta = <em>pieczątka</em></div>${clip({ id: "c08-v", src: KARTA, from: 0.0, w: 800, h: 896, vw: 800, vh: 896, dark: true })}`,
    anim: `` },
  { id: "c09-nagroda", anchor: "po kilku wraca", enter: "up",
    body: `<div class="h">Po kilku: <em>nagroda</em></div>${clip({ id: "c09-v", src: KARTA, from: 2.3, w: 800, h: 896, vw: 800, vh: 896, dark: true })}`,
    anim: `tl.fromTo("#c09-v", { scale: 1 }, { scale: 1.04, duration: 0.5, yoyo: true, repeat: 1, ease: "power1.inOut" }, 0.9);` },
  { id: "c10-opinia", anchor: "a po wizycie", enter: "flip",
    body: `<div class="h">System sam <em>prosi o opinię</em></div>${clip({ id: "c10-v", src: FILM, from: 30.0, w: 560, h: 880, vw: 1564, vh: 880, left: -111 })}`,
    anim: `` },
  { id: "c11-setki", anchor: "stad te setki", enter: "slam",
    body: `<div class="big g" id="c11-n">+300</div><div class="sub">setki opinii w miesiącu</div><div class="stars gold" id="c11-s"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>`,
    anim: `const n = { v: 300 }, el = q("#c11-n");
      tl.to(n, { v: 357, duration: 1.1, ease: "power1.out", onUpdate: () => { el.textContent = "+" + Math.round(n.v); } }, 0.2);
      tl.fromTo("#c11-s span", { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(3)", stagger: 0.08 }, 0.3);` },
  { id: "c12-push", anchor: "mozesz tez", enter: "up",
    body: `<div class="h">Powiadomienia <em>push</em></div>${clip({ id: "c12-v", src: FILM, from: 21.0, w: 1000, h: 563, vw: 1000, vh: 563 })}`,
    anim: `` },
  { id: "c13-promo", anchor: "na przyklad 20", enter: "slam",
    body: `<div class="sticky" id="c13-s">20% na wszystko w ten weekend</div><div class="mono">wysyłasz jednym kliknięciem</div>`,
    anim: `tl.fromTo("#c13-s", { rotation: -5 }, { rotation: -1.5, duration: 0.5, ease: "back.out(2)" }, 0);` },
  { id: "c14-automat", anchor: "albo system", enter: "zoom",
    body: `<div class="h">Albo <em>automat</em></div>${clip({ id: "c14-v", src: FILM, from: 22.6, w: 1000, h: 563, vw: 1000, vh: 563 })}<div class="mono">klient jest obok · blisko nagrody · 14 dni bez wizyty</div>`,
    anim: `` },
  { id: "c15-km", anchor: "zalozmy ze klient", enter: "right",
    body: `<div class="h">Klient jest <em>kilometr</em> od lokalu</div>${clip({ id: "c15-v", src: FILM, from: 25.0, w: 1000, h: 563, vw: 1000, vh: 563 })}`,
    anim: `` },
  { id: "c16-oferta", anchor: "i automatycznie", enter: "up",
    body: `<div class="h">…i dostaje <em>powiadomienie</em></div><div class="notif" id="c16-n"><i></i><div><b>Twój lokal</b><span>Dziś czeka na Ciebie specjalna oferta 🎉</span></div></div><div class="mono">sam, bez Twojego udziału</div>`,
    anim: `tl.fromTo("#c16-n", { opacity: 0, y: -90, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.8)" }, 0.6);
      tl.fromTo("#c16-n", { x: 0 }, { x: 6, duration: 0.06, yoyo: true, repeat: 5, ease: "none" }, 1.2);` },
  { id: "c17-system", anchor: "jesli chcesz", enter: "zoom",
    body: `<div class="kicker">Co dalej</div><div class="h">System ustawiony <em>pod Twoją restaurację</em></div>`,
    anim: `` },
  { id: "c18-meet", anchor: "umowimy sie", enter: "right",
    body: `<div class="card"><div class="meet"><i></i><div><b>Spotkanie online</b><span>Google Meet · ok. 15 minut</span></div></div></div>`,
    anim: `` },
  { id: "c19-kreator", anchor: "ustalimy", enter: "flip",
    body: `<div class="h">Twoje <em>kolory</em>, grafika i nagroda</div>${clip({ id: "c19-v", src: FILM, from: 4.8, w: 1000, h: 563, vw: 1000, vh: 563 })}`,
    anim: `` },
  { id: "c20-jutro", anchor: "juz jutro", enter: "up",
    body: `<div class="kicker">Już jutro</div><div class="h">Twoja karta <em>w portfelu</em> gości</div>${clip({ id: "c20-v", src: FILM, from: 11.0, w: 600, h: 760, vw: 1351, vh: 760, left: -38 })}`,
    anim: `` },
  { id: "c21-14dni", anchor: "pierwsze 14", enter: "slam",
    body: `<div class="sticky" id="c21-s" style="font-size:96px;max-width:none;white-space:nowrap">Pierwsze 14 dni<br>za darmo</div>`,
    anim: `tl.fromTo("#c21-s", { rotation: -6 }, { rotation: -2, duration: 0.5, ease: "back.out(2)" }, 0);` },
  { id: "c22-ryzyko", anchor: "wiec nie ryzykujesz", enter: "right",
    body: `<div class="h">Nie ryzykujesz <em>niczym</em></div><div class="chips" style="flex-direction:column;gap:22px" id="c22-c"><span class="chip">bez umowy</span><span class="chip">bez instalacji</span><span class="chip">bez kosztów na start</span></div>`,
    anim: `tl.fromTo("#c22-c .chip", { opacity: 0, y: 24, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(2)", stagger: 0.35 }, 0.3);` },
  { id: "c23-odpisz", anchor: "wystarczy ze", enter: "up",
    body: `<div class="h">Odpisz na <em>tę wiadomość</em></div><div class="bubble" id="c23-b"><span>chcę</span> <span>poznać</span> <span>szczegóły</span></div>`,
    anim: `tl.fromTo("#c23-b span", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.2, stagger: 0.35 }, 0.6);` },
  { id: "c24-link", anchor: "a my wyslemy", enter: "zoom",
    body: `<div class="card"><div class="meet"><i></i><div><b>Link do Google Meet</b><span>wysyłamy od razu</span></div></div></div><div class="logo" style="font-size:110px;margin-top:20px">Scanova<small>scanova.tech</small></div>`,
    anim: `` },
];

const starts = SHOTS.map((s) => Math.max(0, r2(at(s.anchor) - 0.12)));
starts[0] = 0;
const shots = SHOTS.map((s, i) => ({ ...s, start: starts[i], end: i + 1 < SHOTS.length ? starts[i + 1] : DUR }));
for (let i = 1; i < shots.length; i++) if (shots[i].start <= shots[i - 1].start) throw new Error(`Kolejność ujęć: ${shots[i].id}`);

const CDIR = path.join(ROOT, "compositions", "c");
rmSync(CDIR, { recursive: true, force: true });
mkdirSync(CDIR, { recursive: true });
for (const s of shots) {
  const d = r2(s.end - s.start);
  const html = `<!doctype html>
<html lang="pl" data-composition-variables='[{"id":"dur","type":"number","label":"Długość ujęcia (s)","default":${d}}]'>
  <head><meta charset="UTF-8" /><title>${s.id}</title></head>
  <body>
    <template>
      <style>${CSS}</style>
      <div id="root" data-composition-id="${s.id}" data-width="${W}" data-height="${STAGE_H}">
        <div class="stage" id="${s.id}-stage">
          ${s.body.replace(/DURATION/g, String(d))}
        </div>
      </div>
      <script>
        (function () {
          const vars = (window.__hyperframes && window.__hyperframes.getVariables && window.__hyperframes.getVariables()) || {};
          const dur = Number.isFinite(+vars.dur) && +vars.dur > 0 ? +vars.dur : ${d};
          const q = (sel) => document.querySelector(sel);
          const S = "#${s.id}-stage";
          const tl = gsap.timeline({ paused: true });
          ${ENTER[s.enter]}
          ${WORDS}
          ${s.anim}
          ${EXIT}
          window.__timelines["${s.id}"] = tl;
        })();
      </script>
    </template>
  </body>
</html>
`;
  writeFileSync(path.join(CDIR, `${s.id}.html`), html);
}

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
      #bg { position: absolute; inset: 0; background: #fcfcfa; }
      #bg i { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55; display: block; }
      #bg .b1 { width: 900px; height: 900px; left: -300px; top: -200px; background: #dbe7ff; }
      #bg .b2 { width: 800px; height: 800px; right: -300px; top: 700px; background: #e3f5e8; }
      #bg .b3 { width: 700px; height: 700px; left: 100px; bottom: -300px; background: #fff3c4; }
      .clip { position: absolute; }
      #adam { position: absolute; left: 660px; top: 1480px; width: 380px; height: 380px; object-fit: cover; border-radius: 48px; border: 8px solid #1c1c1c; box-shadow: 0 24px 60px rgba(0,0,0,.25); z-index: 3; }
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
console.log(`C v2: ${shots.length} ujęć · ` + shots.map((s) => `${s.id.slice(0, 3)}@${s.start}`).join(" "));
