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
const OFFSET = 1.0; // wycięta pierwsza sekunda nagrania (otwarta buzia)
const W = 1080, H = 1920, DUR = r2(T.video.duration - OFFSET);
const STAGE_H = 1300; // ujęcia: 0–1300 · napisy: 1330–1460 · Adam: 1480–1860 (prawy dolny róg)
function r2(n) { return Math.round(n * 100) / 100; }

const norm = (x) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
function at(phrase) {
  const ws = (T.captions || []).map((w) => norm(w.w));
  const joined = ws.join(" ");
  const i = joined.indexOf(norm(phrase));
  if (i < 0) throw new Error(`Nie ma w transkrypcji: „${phrase}”`);
  const wi = i > 0 ? joined.slice(0, i).trim().split(" ").length : 0;
  return r2(T.captions[wi].s - OFFSET);
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
  .hbox { position: relative; height: 230px; width: 920px; }
  .hbox .h { position: absolute; left: 0; right: 0; top: 0; opacity: 0; }
  .scard { width: 760px; height: 480px; border-radius: 44px; background: #1d5fd1; color: #fff; box-shadow: 0 30px 70px rgba(0,0,0,.22); position: relative; overflow: hidden; text-align: left; }
  .scard .top { display: flex; justify-content: space-between; align-items: center; padding: 34px 40px 0; font-weight: 700; font-size: 34px; }
  .scard .top small { font-family: "Space Mono", monospace; font-size: 26px; opacity: .85; }
  .scard .slots { display: flex; gap: 26px; padding: 44px 40px 0; }
  .scard .slots i { width: 90px; height: 90px; border-radius: 50%; border: 5px solid rgba(255,255,255,.55); display: grid; place-items: center; font-style: normal; font-size: 40px; position: relative; }
  .scard .slots i b { position: absolute; inset: -5px; border-radius: 50%; background: #fff; display: grid; place-items: center; color: #1d5fd1; font-size: 44px; opacity: 0; }
  .scard .nag { position: absolute; left: 40px; right: 40px; bottom: 36px; display: flex; justify-content: space-between; align-items: center; }
  .scard .nag small { font-family: "Space Mono", monospace; font-size: 24px; opacity: .85; display: block; }
  .scard .nag b { font-size: 40px; }
  .scard .ribbon { position: absolute; left: 0; right: 0; top: 50%; margin-top: -60px; background: #fff4a8; color: #1c1c1c; font-weight: 900; font-size: 56px; text-align: center; padding: 26px 0; transform: rotate(-4deg); box-shadow: 0 16px 40px rgba(0,0,0,.25); opacity: 0; }
  .review { width: 760px; border-radius: 44px; background: #fff; border: 6px solid #1c1c1c; box-shadow: 12px 16px 0 rgba(0,0,0,.08); padding: 44px 40px; box-sizing: border-box; position: absolute; left: 0; top: 0; opacity: 0; }
  .review b { display: block; font-size: 54px; margin-bottom: 18px; }
  .review .btn { display: inline-block; margin-top: 22px; background: #1f8f3e; color: #fff; font-weight: 700; font-size: 38px; padding: 20px 36px; border-radius: 20px; }
  .conf { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; }
  .conf i { position: absolute; left: 0; top: 0; width: 18px; height: 18px; border-radius: 4px; opacity: 0; display: block; }
  .qrbox { width: 480px; height: 480px; background: #fff; border: 10px solid #1c1c1c; border-radius: 36px; display: grid; place-items: center; position: relative; overflow: hidden; }
  .qrbox svg { width: 74%; height: 74%; }
  .qrbox .scan { position: absolute; left: 0; right: 0; top: 0; height: 14px; background: #1d5fd1; box-shadow: 0 0 40px 10px rgba(29,95,209,.45); }
  .lock { width: 700px; height: 700px; border-radius: 64px; background: radial-gradient(circle at 30% 20%, #4b6cb7, #182848); box-shadow: 0 30px 70px rgba(0,0,0,.25); position: relative; overflow: hidden; }
  .lock .time { position: absolute; left: 0; right: 0; top: 80px; text-align: center; color: #fff; font-weight: 700; font-size: 150px; letter-spacing: -.03em; }
  .lock .date { position: absolute; left: 0; right: 0; top: 250px; text-align: center; color: rgba(255,255,255,.8); font-family: "Space Mono", monospace; font-size: 28px; }
  .lock .push { position: absolute; left: 44px; right: 44px; top: 360px; border-radius: 30px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,.35); }
  .lock .push img { width: 100%; display: block; }
  .map { width: 700px; height: 700px; border-radius: 50%; background: #eef1f7; position: relative; background-image: linear-gradient(#dfe4ee 2px, transparent 2px), linear-gradient(90deg, #dfe4ee 2px, transparent 2px); background-size: 88px 88px; overflow: hidden; }
  .map .ring { position: absolute; left: 50%; top: 50%; width: 500px; height: 500px; margin: -250px 0 0 -250px; border-radius: 50%; border: 7px dashed #1f8f3e; background: rgba(31,143,62,.09); }
  .map .km { position: absolute; left: 50%; top: 50%; margin: -292px 0 0 -62px; font-family: "Space Mono", monospace; font-weight: 700; font-size: 32px; color: #1f8f3e; background: #fff; padding: 6px 18px; border-radius: 999px; }
  .map .pin { position: absolute; left: 50%; top: 50%; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 50% 50% 50% 0; background: #d2262e; transform: rotate(-45deg); }
  .map .client { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; background: #1d5fd1; border: 6px solid #fff; box-shadow: 0 8px 20px rgba(0,0,0,.25); }
  .anotif { position: absolute; left: 50%; bottom: 16px; width: 700px; margin-left: -350px; z-index: 2; }
  .phone { width: 560px; aspect-ratio: 900 / 1272; border-radius: 48px; overflow: hidden; box-shadow: 0 30px 70px rgba(0,0,0,.22); background: #fff; position: relative; }
  .phone img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .badge { position: absolute; right: -20px; top: -20px; background: #d2262e; color: #fff; font-family: "Space Mono", monospace; font-weight: 700; font-size: 34px; padding: 16px 26px; border-radius: 999px; transform: rotate(8deg); box-shadow: 0 12px 30px rgba(0,0,0,.25); }
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
const QR_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="#1c1c1c"><rect x="6" y="6" width="30" height="30"/><rect x="64" y="6" width="30" height="30"/><rect x="6" y="64" width="30" height="30"/><rect x="44" y="6" width="8" height="8"/><rect x="44" y="22" width="8" height="8"/><rect x="44" y="44" width="12" height="12"/><rect x="64" y="44" width="8" height="8"/><rect x="80" y="44" width="14" height="8"/><rect x="44" y="64" width="8" height="12"/><rect x="60" y="60" width="8" height="8"/><rect x="76" y="64" width="18" height="8"/><rect x="60" y="80" width="12" height="14"/><rect x="80" y="80" width="14" height="14"/></g><g fill="#fff"><rect x="13" y="13" width="16" height="16"/><rect x="71" y="13" width="16" height="16"/><rect x="13" y="71" width="16" height="16"/></g><g fill="#1c1c1c"><rect x="17" y="17" width="8" height="8"/><rect x="75" y="17" width="8" height="8"/><rect x="17" y="75" width="8" height="8"/></g></svg>`;
const CONF = Array.from({ length: 14 }, (_, k) => `<i style="background:${["#1d5fd1", "#1f8f3e", "#f4c542", "#d2262e"][k % 4]}"></i>`).join("");

const SHOTS = [
  { id: "c01-huk", anchor: "jeden z naszych", enter: "slam",
    body: `<div class="kicker">Jeden z naszych klientów · 1 miesiąc</div><div class="big g" id="c01-n">+357</div><div class="sub">nowych opinii w Google</div><div class="stars" id="c01-s"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>`,
    anim: `const n = { v: 0 }, el = q("#c01-n");
      tl.to(n, { v: 357, duration: 1.1, ease: "power3.out", onUpdate: () => { el.textContent = "+" + Math.round(n.v); } }, 0.1);
      tl.fromTo("#c01-s span", { opacity: 0, scale: 0.2, y: -40 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(3)", stagger: 0.09 }, 0.9);
      tl.to("#c01-s span", { color: "#b08e30", duration: 0.15, stagger: 0.09 }, 1.0);
      tl.fromTo(el, { scale: 1 }, { scale: 1.08, duration: 0.18, yoyo: true, repeat: 1, ease: "power1.inOut" }, 3.6);` },
  { id: "c02-klienci", anchor: "zbudowal baze", enter: "up",
    body: `<div class="big b" id="c02-n">0</div><div class="sub">stałych klientów</div><div class="avatars" id="c02-a"><i style="background:#1d5fd1">A</i><i style="background:#1f8f3e">M</i><i style="background:#d2262e">K</i><i style="background:#5d5d62">J</i><i style="background:#f4c542;color:#1c1c1c">+</i></div>`,
    anim: `const n = { v: 0 }, el = q("#c02-n");
      tl.to(n, { v: 676, duration: 1.2, ease: "power3.out", onUpdate: () => { el.textContent = Math.round(n.v); } }, 0.1);
      tl.fromTo("#c02-a i", { opacity: 0, scale: 0.2, x: 60 }, { opacity: 1, scale: 1, x: 0, duration: 0.45, ease: "back.out(2.2)", stagger: 0.1 }, 0.4);` },
  { id: "c03-wracaja", anchor: "ktorzy wracaja", enter: "right",
    body: `<div class="h">Klienci <em>wracają sami</em></div><div class="bars" id="c03-b"><i style="height:30%"></i><i style="height:38%"></i><i style="height:34%"></i><i style="height:48%"></i><i style="height:56%"></i><i style="height:52%"></i><i style="height:66%"></i><i style="height:72%"></i><i style="height:70%"></i><i style="height:84%"></i><i style="height:92%"></i><i style="height:100%"></i></div><div class="mono">powroty tydzień po tygodniu</div>`,
    anim: `tl.fromTo("#c03-b i", { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: "power3.out", stagger: 0.07 }, 0.3);` },
  { id: "c04-scanova", anchor: "jestesmy scanova", enter: "zoom",
    body: `<div class="logo" id="c04-l"><span class="w">S</span><span class="w">c</span><span class="w">a</span><span class="w">n</span><span class="w">o</span><span class="w">v</span><span class="w">a</span><small>cyfrowe karty lojalnościowe dla lokali</small></div>`,
    anim: `tl.fromTo("#c04-l .w", { opacity: 0, y: 60, rotation: -8 }, { opacity: 1, y: 0, rotation: 0, duration: 0.5, ease: "back.out(2)", stagger: 0.07 }, 0.1);
      tl.fromTo("#c04-l small", { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.9);` },
  { id: "c05-qr", anchor: "klient skanuje", enter: "up",
    body: `<div class="h">Klient <em>skanuje</em> kod przy kasie</div><div class="qrbox" id="c05-q">${QR_SVG}<div class="scan" id="c05-scan"></div></div>`,
    anim: `tl.fromTo("#c05-scan", { y: 0 }, { y: 460, duration: 0.9, ease: "power1.inOut", yoyo: true, repeat: 1 }, 0.5);
      tl.fromTo("#c05-q", { borderColor: "#1c1c1c" }, { borderColor: "#1f8f3e", duration: 0.3 }, 2.3);` },
  { id: "c06-wallet", anchor: "i karta od razu", enter: "flip",
    body: `${clip({ id: "c06-v", src: FILM, from: 10.3, w: 620, h: 980, vw: 1742, vh: 980, left: -125 })}<div class="chips" id="c06-c"><span class="chip">Apple Wallet</span><span class="chip">Google Wallet</span></div>`,
    anim: `tl.fromTo("#c06-c .chip", { opacity: 0, y: 24, rotation: -4 }, { opacity: 1, y: 0, rotation: 0, duration: 0.45, ease: "back.out(2)", stagger: 0.3 }, 2.2);` },
  { id: "c07-bez", anchor: "bez aplikacji", enter: "zoom",
    body: `<div class="h">Bez…</div><div class="chips" style="flex-direction:column;gap:26px" id="c07-c"><span class="chip off">aplikacji<i></i></span><span class="chip off">rejestracji<i></i></span><span class="chip off">pobierania<i></i></span></div>`,
    anim: `tl.fromTo("#c07-c .chip", { opacity: 0, x: -60, rotation: -6 }, { opacity: 1, x: 0, rotation: 0, duration: 0.45, ease: "back.out(1.8)", stagger: 0.7 }, 0.3);
      tl.fromTo("#c07-c .chip i", { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power3.out", stagger: 0.7 }, 0.75);` },
  // JEDNA animacja: pieczątki → nagroda → prośba o opinię → setki opinii
  { id: "c08-karta", anchor: "za kazda wizyte", enter: "up", marksSpec: { tN: "po kilku wraca", tO: "a po wizycie", tS: "stad te setki" },
    body: `<div class="hbox"><div class="h" id="c08-h1">Każda wizyta = <em>pieczątka</em></div><div class="h" id="c08-h2">Po kilku: <em>nagroda</em></div><div class="h" id="c08-h3">Po wizycie: <em>prośba o opinię</em></div><div class="h" id="c08-h4">Stąd <em>setki opinii</em></div></div>
      <div style="position:relative;width:760px;height:480px">
        <div class="scard" id="c08-card"><div class="top"><span>Twój lokal</span><small id="c08-cnt">0/6</small></div><div class="slots" id="c08-slots"><i><b>✓</b></i><i><b>✓</b></i><i><b>✓</b></i><i><b>✓</b></i><i><b>✓</b></i><i><b>✓</b></i></div><div class="nag"><div><small>NAGRODA</small><b>Kawa gratis</b></div></div><div class="ribbon" id="c08-rib">🎁 Nagroda gotowa</div></div>
        <div class="conf" id="c08-conf">${CONF}</div>
        <div class="review" id="c08-rev"><b>Podobało się?</b><div class="stars" id="c08-st"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div><span class="btn">Zostaw opinię w Google</span></div>
      </div>
      <div class="big g" id="c08-n" style="font-size:220px;opacity:0;position:absolute;left:0;right:0;top:520px">+357</div>`,
    anim: `const cnt = q("#c08-cnt");
      // 1. pieczątki jedna po drugiej do tN
      const slots = document.querySelectorAll("#c08-slots i b");
      const step = Math.max(0.25, (tN - 0.6) / 6);
      slots.forEach((b, k) => {
        tl.fromTo(b, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(3)", onStart: () => { cnt.textContent = (k + 1) + "/6"; }, onReverseComplete: () => { cnt.textContent = k + "/6"; } }, 0.5 + k * step);
      });
      // 2. nagroda: wstęga + konfetti
      tl.fromTo("#c08-rib", { opacity: 0, scale: 0.5, rotation: -14 }, { opacity: 1, scale: 1, rotation: -4, duration: 0.5, ease: "back.out(2.5)" }, tN + 0.1);
      document.querySelectorAll("#c08-conf i").forEach((c, k) => {
        const a = (k / 14) * Math.PI * 2;
        tl.fromTo(c, { opacity: 1, x: 0, y: 0, rotation: 0 }, { x: Math.cos(a) * 360, y: Math.sin(a) * 260 + 120, rotation: 540, opacity: 0, duration: 1.1, ease: "power2.out" }, tN + 0.15);
      });
      // 3. karta obraca się w prośbę o opinię
      tl.to("#c08-card", { rotationY: 90, transformPerspective: 1600, duration: 0.35, ease: "power2.in" }, tO);
      tl.fromTo("#c08-rev", { opacity: 1, rotationY: -90, transformPerspective: 1600 }, { rotationY: 0, duration: 0.4, ease: "power2.out" }, tO + 0.35);
      tl.to("#c08-st span", { color: "#f4c542", duration: 0.2, stagger: 0.14 }, tO + 0.9);
      tl.fromTo("#c08-rev .btn", { scale: 1 }, { scale: 1.07, duration: 0.25, yoyo: true, repeat: 1 }, tO + 1.9);
      // 4. setki opinii: panel odlatuje, licznik
      tl.to("#c08-rev", { y: -520, opacity: 0, duration: 0.45, ease: "power2.in" }, tS);
      const n = { v: 1 }, el = q("#c08-n");
      tl.fromTo(el, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: "power4.out" }, tS + 0.25);
      tl.to(n, { v: 357, duration: 1.1, ease: "power2.out", onUpdate: () => { el.textContent = "+" + Math.round(n.v); } }, tS + 0.3);
      // nagłówki
      const hs = ["#c08-h1", "#c08-h2", "#c08-h3", "#c08-h4"], ts = [0, tN, tO, tS];
      hs.forEach((h, k) => {
        tl.fromTo(h, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, ts[k] + (k ? 0.05 : 0.1));
        if (k < 3) tl.to(h, { opacity: 0, y: -20, duration: 0.25 }, ts[k + 1]);
      });` },
  { id: "c09-push", anchor: "mozesz tez", enter: "right",
    body: `<div class="h">Powiadomienia <em>push</em> do klientów</div><div class="lock"><div class="time">12:30</div><div class="date">sobota, 18 października</div><div class="push" id="c09-p"><img src="assets/push.png" alt="Powiadomienie"></div></div>`,
    anim: `tl.fromTo("#c09-p", { opacity: 0, y: -160 }, { opacity: 1, y: 0, duration: 0.7, ease: "back.out(1.6)" }, 0.8);
      tl.fromTo("#c09-p", { x: 0 }, { x: 5, duration: 0.05, yoyo: true, repeat: 5, ease: "none" }, 1.5);` },
  { id: "c10-promo", anchor: "na przyklad 20", enter: "slam",
    body: `<div class="sticky" id="c10-s">20% na wszystko w ten weekend</div><div class="mono">wysyłasz jednym kliknięciem</div>`,
    anim: `tl.fromTo("#c10-s", { rotation: -5 }, { rotation: -1.5, duration: 0.5, ease: "back.out(2)" }, 0);` },
  // JEDNA animacja: automat → klient kilometr od lokalu → dostaje powiadomienie
  { id: "c11-automat", anchor: "albo system", enter: "zoom", marksSpec: { tK: "zalozmy ze klient", tA: "i automatycznie" },
    body: `<div class="hbox"><div class="h" id="c11-h1">Albo <em>automat</em></div><div class="h" id="c11-h2">Klient jest <em>kilometr</em> od lokalu</div><div class="h" id="c11-h3">…i sam dostaje <em>powiadomienie</em></div></div>
      <div class="map"><div class="ring" id="c11-r"></div><div class="km" id="c11-km">1 km</div><div class="pin" id="c11-pin"></div><div class="client" id="c11-c"></div></div><div class="notif anotif" id="c11-n"><i></i><div><b>Twój lokal</b><span>Dziś czeka na Ciebie specjalna oferta 🎉</span></div></div>`,
    anim: `tl.fromTo("#c11-r", { scale: 0.1, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: "power2.out" }, 0.4);
      tl.fromTo("#c11-km", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.1);
      tl.fromTo("#c11-r", { scale: 1 }, { scale: 1.06, duration: 0.6, yoyo: true, repeat: 3, ease: "sine.inOut" }, 1.4);
      tl.fromTo("#c11-c", { x: 420, y: -300, opacity: 0 }, { opacity: 1, duration: 0.2 }, tK);
      tl.to("#c11-c", { x: 130, y: -90, duration: 2.0, ease: "power1.inOut" }, tK + 0.1);
      tl.fromTo("#c11-pin", { scale: 1 }, { scale: 1.3, duration: 0.25, yoyo: true, repeat: 3, ease: "power1.inOut" }, tK + 2.0);
      tl.fromTo("#c11-n", { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.8)" }, tA + 0.2);
      tl.fromTo("#c11-n", { x: 0 }, { x: 6, duration: 0.06, yoyo: true, repeat: 5, ease: "none" }, tA + 0.9);
      const hs = ["#c11-h1", "#c11-h2", "#c11-h3"], ts = [0, tK, tA];
      hs.forEach((h, k) => {
        tl.fromTo(h, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, ts[k] + (k ? 0.05 : 0.1));
        if (k < 2) tl.to(h, { opacity: 0, y: -20, duration: 0.25 }, ts[k + 1]);
      });` },
  { id: "c12-system", anchor: "jesli chcesz", enter: "zoom",
    body: `<div class="kicker">Co dalej</div><div class="h">System ustawiony <em>pod Twoją restaurację</em></div>`,
    anim: `` },
  { id: "c13-meet", anchor: "umowimy sie", enter: "right",
    body: `<div class="card"><div class="meet"><i></i><div><b>Spotkanie online</b><span>Google Meet · ok. 15 minut</span></div></div></div>`,
    anim: `` },
  { id: "c14-kreator", anchor: "ustalimy", enter: "flip",
    body: `<div class="h">Twoje <em>kolory</em>, grafika i nagroda</div>${clip({ id: "c14-v", src: FILM, from: 4.8, w: 1000, h: 563, vw: 1000, vh: 563 })}`,
    anim: `` },
  { id: "c15-jutro", anchor: "juz jutro", enter: "up",
    body: `<div class="h">Twoja karta <em>w portfelu</em> gości</div><div class="phone" id="c15-p"><img src="assets/karta-wallet.png" alt="Karta"><div class="badge" id="c15-b">już jutro</div></div>`,
    anim: `tl.fromTo("#c15-p", { y: 260, opacity: 0, rotation: 4 }, { y: 0, opacity: 1, rotation: 0, duration: 0.8, ease: "power3.out" }, 0.3);
      tl.fromTo("#c15-b", { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(3)" }, 1.2);` },
  { id: "c16-14dni", anchor: "pierwsze 14", enter: "slam",
    body: `<div class="sticky" id="c16-s" style="font-size:96px;max-width:none;white-space:nowrap">Pierwsze 14 dni<br>za darmo</div>`,
    anim: `tl.fromTo("#c16-s", { rotation: -6 }, { rotation: -2, duration: 0.5, ease: "back.out(2)" }, 0);` },
  { id: "c17-ryzyko", anchor: "wiec nie ryzykujesz", enter: "right",
    body: `<div class="h">Nie ryzykujesz <em>niczym</em></div><div class="chips" style="flex-direction:column;gap:22px" id="c17-c"><span class="chip">bez umowy</span><span class="chip">bez instalacji</span><span class="chip">bez kosztów na start</span></div>`,
    anim: `tl.fromTo("#c17-c .chip", { opacity: 0, y: 24, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(2)", stagger: 0.35 }, 0.3);` },
  { id: "c18-odpisz", anchor: "wystarczy ze", enter: "up",
    body: `<div class="h">Odpisz na <em>tę wiadomość</em></div><div class="bubble" id="c18-b"><span>chcę</span> <span>poznać</span> <span>szczegóły</span></div>`,
    anim: `tl.fromTo("#c18-b span", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.2, stagger: 0.35 }, 0.6);` },
  { id: "c19-link", anchor: "a my wyslemy", enter: "zoom",
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
  s.marks = {};
  for (const [k, phrase] of Object.entries(s.marksSpec || {})) s.marks[k] = Math.max(0.3, r2(at(phrase) - s.start));
  const varsDecl = [{ id: "dur", type: "number", label: "Długość ujęcia (s)", default: d }].concat(Object.entries(s.marks).map(([k, v]) => ({ id: k, type: "number", label: k, default: v })));
  const html = `<!doctype html>
<html lang="pl" data-composition-variables='${JSON.stringify(varsDecl)}'>
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
          const num = (v, dflt) => (Number.isFinite(+v) && +v > 0 ? +v : dflt);
          ${Object.entries(s.marks).map(([k, v]) => `const ${k} = num(vars.${k}, ${v});`).join("\n          ")}
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
const CAP = lines((T.captions || []).map((w) => ({ ...w, s: r2(w.s - OFFSET), e: r2(w.e - OFFSET) })).filter((w) => w.e > 0.2).map((w) => ({ ...w, s: Math.max(0, w.s) })));
const capMarkup = CAP.map((ln, i) => `<div class="cap-line" id="cap-l${i}">${ln.map((w, j) => `<span class="cap-w" id="cap-w${i}-${j}">${w.w.replace(/</g, "&lt;")}</span>`).join(" ")}</div>`).join("\n        ");
const capTl = [];
CAP.forEach((ln, i) => {
  const next = CAP[i + 1];
  const s = ln[0].s, e = Math.min(ln[ln.length - 1].e + 0.18, next ? next[0].s - 0.12 : DUR);
  capTl.push(`tl.fromTo("#cap-l${i}", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, ${r2(s)});`);
  capTl.push(`tl.to("#cap-l${i}", { opacity: 0, duration: 0.08 }, ${r2(Math.max(s + 0.2, e))});`);
  ln.forEach((w, j) => capTl.push(`tl.fromTo("#cap-w${i}-${j}", { opacity: 0.55, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.14, ease: "back.out(2)" }, ${r2(w.s)});`));
});

const hosts = shots.map((s) => `<div id="el-${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/c/${s.id}.html" data-start="${r2(s.start)}" data-duration="${r2(s.end - s.start)}" data-track-index="2" data-width="${W}" data-height="${STAGE_H}" data-variable-values='${JSON.stringify(Object.assign({ dur: r2(s.end - s.start) }, s.marks))}' style="position:absolute; left:0; top:0; width:${W}px; height:${STAGE_H}px;"></div>`).join("\n      ");

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
      .clip { position: absolute; }
      #adam { position: absolute; left: 660px; top: 1480px; width: 380px; height: 380px; object-fit: cover; border-radius: 48px; border: 8px solid #1c1c1c; box-shadow: 0 24px 60px rgba(0,0,0,.25); z-index: 3; }
      #caps { position: absolute; left: 0; width: 1080px; top: 1330px; height: 140px; pointer-events: none; }
      .cap-line { position: absolute; left: 0; right: 0; top: 0; text-align: center; font-weight: 700; font-size: 60px; line-height: 1.2; color: #1c1c1c; opacity: 0; padding: 0 60px; }
      .cap-w { display: inline-block; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="rolka-c" data-start="0" data-width="${W}" data-height="${H}" data-duration="${r2(DUR)}">
      <div id="bg"></div>
      <video id="adam" class="clip" src="${T.video.pip}" playsinline data-has-audio="true" data-start="0" data-media-start="${OFFSET}" data-duration="${r2(DUR)}" data-track-index="1" data-volume="1"></video>
      ${hosts}
      <div id="caps" class="clip" data-start="0" data-duration="${r2(DUR)}" data-track-index="5">
        ${capMarkup}
      </div>
    </div>
    <script>
      (function () {
        const tl = gsap.timeline({ paused: true });
        ${capTl.join("\n        ")}
        window.__timelines["rolka-c"] = tl;
      })();
    </script>
  </body>
</html>
`;
writeFileSync(path.join(ROOT, "..", "rolka-scanova-c", "index.html"), index);
console.log(`C v3: ${shots.length} ujęć · ` + shots.map((s) => `${s.id.slice(0, 3)}@${s.start}`).join(" "));
