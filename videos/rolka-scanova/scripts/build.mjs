// Generuje trzy kompozycje główne z timing.json:
//   index.html      — wersja A „split”: góra grafiki, dół Adam, napisy białe
//   ../rolka-scanova-b/index.html — wersja B „full”: Adam na całym ekranie, grafiki wokół (kompaktowe, przezroczyste tło)
//   ../rolka-scanova-c/index.html — wersja C „pip”: cały ekran grafiki, Adam w małym kwadracie
// Uruchom po każdej zmianie timing.json:  node scripts/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const T = JSON.parse(readFileSync(path.join(ROOT, "timing.json"), "utf8"));
const W = 1080, H = 1920, DUR = T.video.duration;
const r2 = (n) => Math.round(n * 100) / 100;

// Napisy: grupujemy słowa w linie (maks. 4 słowa albo przerwa > 0,7 s albo koniec zdania).
function lines(words) {
  const out = [];
  let cur = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (cur.length && (cur.length >= 4 || w.s - prev.e > 0.7 || /[.?!]$/.test(prev.w))) { out.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out;
}
const CAP_LINES = lines(T.captions || []);

function captionsMarkup() {
  return CAP_LINES.map((ln, i) =>
    `<div class="cap-line" id="cap-l${i}">${ln.map((w, j) => `<span class="cap-w" id="cap-w${i}-${j}">${w.w.replace(/</g, "&lt;")}</span>`).join(" ")}</div>`
  ).join("\n        ");
}
function captionsTimeline() {
  const js = [];
  CAP_LINES.forEach((ln, i) => {
    const next = CAP_LINES[i + 1];
    const s = ln[0].s, e = Math.min(ln[ln.length - 1].e + 0.18, next ? next[0].s - 0.12 : DUR);
    js.push(`tl.fromTo("#cap-l${i}", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, ${r2(s)});`);
    js.push(`tl.to("#cap-l${i}", { opacity: 0, duration: 0.08 }, ${r2(Math.max(s + 0.2, e))});`);
    ln.forEach((w, j) => {
      js.push(`tl.fromTo("#cap-w${i}-${j}", { opacity: 0.6, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.14, ease: "back.out(2)" }, ${r2(w.s)});`);
    });
  });
  return js.join("\n          ");
}

// Czas (globalny) pierwszego wystąpienia frazy w transkrypcji; null gdy brak.
const norm = (x) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9 ]+/g, " ").trim();
function at(phrase) {
  const ws = (T.captions || []).map((w) => norm(w.w));
  const joined = ws.join(" ");
  const i = joined.indexOf(norm(phrase));
  if (i < 0) return null;
  const wi = i > 0 ? joined.slice(0, i).trim().split(" ").length : 0;
  return T.captions[wi].s;
}
// Kroki wewnątrz scen (czas lokalny = globalny − start sceny), z domyślnymi wartościami.
function stepVars(sc) {
  const loc = (phrase, dflt) => { const g = at(phrase); return g == null ? dflt : Math.max(0.3, r2(g - sc.start)); };
  if (sc.id === "s2-karta") return { t2: loc("za kazda wizyte", 5), t3: loc("po kilku", 10), t4: loc("a po wizycie", 14) };
  if (sc.id === "s3-push") return { t2: loc("albo system", 7) };
  if (sc.id === "s4-cta") return { tCard: loc("ustalimy", 4.2), tJutro: loc("juz jutro", 8.2), tFree: loc("pierwsze 14", 11), tBubble: loc("wystarczy", 15) };
  return {};
}

function sceneHosts({ left, top, width, height, compact }) {
  return T.scenes.map((sc) => {
    const v = Object.assign({}, stepVars(sc), compact ? { compact: true, bg: "#00000000" } : {});
    const vars = Object.keys(v).length ? ` data-variable-values='${JSON.stringify(v)}'` : "";
    return `<div id="el-${sc.id}" data-composition-id="${sc.id}" data-composition-src="${sc.file}" data-start="${r2(sc.start)}" data-duration="${r2(sc.end - sc.start)}" data-track-index="2" data-width="${width}" data-height="${height}"${vars} style="position:absolute; left:${left}px; top:${top}px; width:${width}px; height:${height}px;"></div>`;
  }).join("\n      ");
}

function page({ title, id, bodyBg, video, scenes, captionsCss, extra = "" }) {
  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      body { margin: 0; background: ${bodyBg}; font-family: Montserrat, sans-serif; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: ${bodyBg}; }
      .clip { position: absolute; }
      #adam { object-fit: cover; }
      #caps { position: absolute; ${captionsCss} pointer-events: none; }
      .cap-line { position: absolute; left: 0; right: 0; text-align: center; font-weight: 700; font-size: 52px; line-height: 1.2; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,.55), 0 0 24px rgba(0,0,0,.35); opacity: 0; padding: 0 40px; }
      .cap-w { display: inline-block; }
      ${extra}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="${id}" data-start="0" data-width="${W}" data-height="${H}" data-duration="${r2(DUR)}">
      ${video}
      ${scenes}
      <div id="caps" class="clip" data-start="0" data-duration="${r2(DUR)}" data-track-index="5">
        ${captionsMarkup()}
      </div>
    </div>
    <script>
      (function () {
        const tl = gsap.timeline({ paused: true });
        ${captionsTimeline()}
        window.__timelines["${id}"] = tl;
      })();
    </script>
  </body>
</html>
`;
}

const V = (style, src = T.video.src) => `<video id="adam" class="clip" src="${src}" playsinline data-has-audio="true" data-start="0" data-duration="${r2(DUR)}" data-track-index="1" data-volume="1" style="${style}"></video>`;

// A · split: góra 0–960 grafiki, dół 960–1920 Adam
writeFileSync(path.join(ROOT, "index.html"), page({
  title: "Rolka Scanovy · A split", id: "rolka-a", bodyBg: "#fcfcfa",
  video: V(`left:0; top:960px; width:1080px; height:960px;`, T.video.split || T.video.src),
  scenes: sceneHosts({ left: 0, top: 0, width: 1080, height: 960, compact: false }),
  captionsCss: `left:0; width:1080px; top:1700px; height:200px;`,
  extra: `#el-s1-huk, #el-s2-karta, #el-s3-push, #el-s4-cta { border-bottom: 6px solid #1c1c1c; box-sizing: border-box; }`,
}));

// B · full: Adam cały ekran, grafiki w górnej 1/3 jako nakładka (kompakt, przezroczyste tło)
writeFileSync(path.join(ROOT, "..", "rolka-scanova-b", "index.html"), page({
  title: "Rolka Scanovy · B full", id: "rolka-b", bodyBg: "#000",
  video: V(`left:0; top:0; width:1080px; height:1920px;`, T.video.full || T.video.src),
  scenes: sceneHosts({ left: 0, top: 960, width: 1080, height: 960, compact: true }),
  captionsCss: `left:0; width:1080px; top:860px; height:180px;`,
}));

// C · pip: od 2026-10-14 generuje osobny scripts/build-c.mjs (ujęcia w compositions/c/).

for (const sc of T.scenes) { const v = stepVars(sc); if (Object.keys(v).length) console.log(sc.id, JSON.stringify(v)); }
console.log(`zbudowano rolka-scanova/index.html, rolka-scanova-b/index.html (C: node scripts/build-c.mjs) · ${DUR}s · sceny: ${T.scenes.map(s => s.id + " " + s.start + "–" + s.end).join(", ")} · linii napisów: ${CAP_LINES.length}`);
