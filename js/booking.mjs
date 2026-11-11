// Course page booking: upcoming group classes, private-time calendar, and the sign-up popup.
import { api, isDemo, fmtDate, fmtTime, parseDate, esc } from "./api.mjs";

const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const G = () => window.gsap;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const WA = () => (document.querySelector(".wa-link") || {}).href || "#";
let state = { classes: [], slots: [], settings: {} };
let current = null; // {type:'class'|'slot', item}

/* ---------- tabs ---------- */
const ind = $(".tab-ind");
function moveInd() { const on = $(".tab.on"); if (!on || !ind) return; ind.style.width = on.offsetWidth + "px"; ind.style.transform = `translateX(${on.offsetLeft - 6}px)`; }
export function setTab(name) {
  $$(".tab").forEach((t) => { const on = t.dataset.tab === name; t.classList.toggle("on", on); t.setAttribute("aria-selected", on); });
  $$(".panel").forEach((p) => p.classList.toggle("on", p.id === "panel-" + name));
  moveInd(); refreshST();
}
$$(".tab").forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));
addEventListener("resize", moveInd);
document.fonts && document.fonts.ready.then(moveInd);
// buttons elsewhere on the page that open a tab (e.g. Services cards)
document.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]:not(.tab)"); if (b) setTab(b.dataset.tab); });

function refreshST() { clearTimeout(refreshST.t); refreshST.t = setTimeout(() => window.ScrollTrigger && window.ScrollTrigger.refresh(), 120); }

/* ---------- group classes ---------- */
function renderClasses() {
  const grid = $("#classGrid");
  if (!state.classes.length) {
    grid.innerHTML = `<div class="empty"><h3>New dates coming soon</h3><p>The next group series hasn't been posted yet. Message me and I'll let you know as soon as it opens.</p><a class="btn" href="${WA()}" target="_blank" rel="noopener">Get notified on WhatsApp <span class="arr">→</span></a></div>`;
    return refreshST();
  }
  grid.innerHTML = state.classes.map((c) => {
    const taken = c.capacity - c.spotsLeft;
    const d = parseDate(c.startDate);
    const range = c.endDate && c.endDate !== c.startDate ? `${fmtDate(c.startDate, { month: "short", day: "numeric" })} – ${fmtDate(c.endDate, { month: "short", day: "numeric" })}` : fmtDate(c.startDate, { weekday: "long", month: "long", day: "numeric" });
    const spotsTxt = c.full ? "Class is full" : c.closed ? "Registration closed" : c.spotsLeft === 1 ? "Only 1 spot left!" : `${c.spotsLeft} of ${c.capacity} spots left`;
    const petals = c.capacity <= 12 ? `<div class="spots" aria-hidden="true">${Array.from({ length: c.capacity }, (_, i) => `<i class="${i < taken ? "taken" : ""}"></i>`).join("")}</div>` : "";
    const action = c.closed
      ? `<a class="wait" href="${WA()}" target="_blank" rel="noopener">Join the waitlist →</a>`
      : `<button class="btn small" data-book="${esc(c.id)}">Request a spot <span class="arr">→</span></button>`;
    return `<article class="cls ${c.closed ? "full" : ""}">
      ${c.full ? '<span class="ribbon">Full</span>' : ""}
      <div class="cls-date"><span>${d.toLocaleDateString("en-US", { month: "short" })}</span><b>${d.getDate()}</b><small>${d.toLocaleDateString("en-US", { weekday: "short" })}</small></div>
      <div>
        <h3>${esc(c.title)}</h3>
        <p class="cls-meta">${esc(c.schedule || (c.time ? fmtTime(c.time) : ""))}</p>
        <p class="cls-meta">${esc(range)}${c.location ? " · " + esc(c.location) : ""}</p>
        ${c.notes ? `<p class="cls-meta" style="font-style:italic">${esc(c.notes)}</p>` : ""}
        ${petals}
        <p class="spots-txt ${c.spotsLeft === 1 ? "hot" : ""}">${spotsTxt}</p>
      </div>
      <div class="cls-foot"><b>$${c.price}</b>${action}</div>
    </article>`;
  }).join("");
  if (G() && !reduce) G().from($$(".cls", grid), { y: 24, opacity: 0, duration: 0.9, ease: "power2.out", stagger: 0.08, scrollTrigger: { trigger: grid, start: "top 88%" } });
  refreshST();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-book]"); if (!b) return;
  const c = state.classes.find((x) => x.id === b.dataset.book); if (c) openModal("class", c);
});

/* ---------- private calendar ---------- */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const today = new Date(); today.setHours(12, 0, 0, 0);
let view = new Date(today.getFullYear(), today.getMonth(), 1);
let selDate = null, selSlot = null;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const slotsOn = (s) => state.slots.filter((x) => x.date === s);

function renderCal() {
  const y = view.getFullYear(), m = view.getMonth();
  $("#calMonth").textContent = `${MONTHS[m]} ${y}`;
  $("#calPrev").disabled = y === today.getFullYear() && m === today.getMonth();
  const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  const avail = new Set(state.slots.map((s) => s.date));
  let html = "";
  for (let i = 0; i < first; i++) html += "<span></span>";
  for (let d = 1; d <= days; d++) {
    const key = ymd(new Date(y, m, d));
    const cls = ["day"]; if (avail.has(key)) cls.push("av"); if (key === selDate) cls.push("sel"); if (key === ymd(today)) cls.push("today");
    html += avail.has(key) ? `<button class="${cls.join(" ")}" data-date="${key}" aria-label="${fmtDate(key, { weekday: "long", month: "long", day: "numeric" })}, open times">${d}</button>` : `<span class="${cls.join(" ")}">${d}</span>`;
  }
  $("#calGrid").innerHTML = html;
  if (G() && !reduce) void 0;
}
function renderTimes() {
  const list = $("#timeList"), btn = $("#bookTimeBtn");
  if (!state.slots.length) {
    $("#timesDate").textContent = "No open times right now";
    list.innerHTML = `<p class="muted">New private times are added often. <a href="${WA()}" target="_blank" rel="noopener" style="color:var(--rose-deep);text-decoration:underline">Message me</a> and we'll find a time that works.</p>`;
    btn.disabled = true; return;
  }
  if (!selDate) { $("#timesDate").textContent = "Pick a day"; list.innerHTML = '<p class="muted">Highlighted days have open times.</p>'; btn.disabled = true; return; }
  $("#timesDate").textContent = fmtDate(selDate, { weekday: "long", month: "long", day: "numeric" });
  list.innerHTML = slotsOn(selDate).map((s) => `<button class="chip ${selSlot === s.id ? "sel" : ""}" data-slot="${esc(s.id)}">${fmtTime(s.time)}${s.duration ? `<small>${esc(s.duration)}</small>` : ""}</button>`).join("");
  btn.disabled = !selSlot;
  if (G() && !reduce) G().from($$(".chip", list), { y: 16, opacity: 0, duration: 0.6, ease: "expo.out", stagger: 0.05 });
}
$("#calPrev").addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(); });
$("#calNext").addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); });
$("#calGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-date]"); if (!b) return; selDate = b.dataset.date; selSlot = null; renderCal(); renderTimes(); });
$("#timeList").addEventListener("click", (e) => { const b = e.target.closest("[data-slot]"); if (!b) return; selSlot = b.dataset.slot; renderTimes(); });
$("#bookTimeBtn").addEventListener("click", () => { const s = state.slots.find((x) => x.id === selSlot); if (s) openModal("slot", s); });

/* ---------- modal ---------- */
const modal = $("#bookModal");
let lastFocus = null;
function openModal(type, item) {
  current = { type, item }; lastFocus = document.activeElement;
  $("#mForm").hidden = false; $("#mDone").hidden = true; $("#mErr").classList.remove("show");
  const price = type === "class" ? item.price : state.settings.privatePrice || 750;
  if (type === "class") {
    $("#mEyebrow").textContent = "Request a spot · we'll talk first";
    $("#mTitle").textContent = item.title;
    $("#mSub").textContent = `${fmtDate(item.startDate, { weekday: "long", month: "long", day: "numeric" })}${item.schedule ? " · " + item.schedule : ""} · $${price}`;
  } else {
    $("#mEyebrow").textContent = "Private course · we'll talk first";
    $("#mTitle").textContent = `${fmtDate(item.date, { weekday: "long", month: "long", day: "numeric" })} at ${fmtTime(item.time)}`;
    $("#mSub").textContent = `Your first private session${item.duration ? " · " + item.duration : ""} · $${price} for the private course`;
  }
  $("#mSubmit").innerHTML = `Request my spot <span class="arr">→</span>`;
  modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
  window.__lenis && window.__lenis.stop(); document.documentElement.style.overflow = "hidden";
  setTimeout(() => $("#b-name").focus(), 350);
}
function closeModal() {
  modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
  window.__lenis && window.__lenis.start(); document.documentElement.style.overflow = "";
  lastFocus && lastFocus.focus && lastFocus.focus();
}
modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) closeModal(); });

$("#bookForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, err = $("#mErr"), btn = $("#mSubmit");
  const body = Object.fromEntries(new FormData(f));
  if (!body.name.trim()) { err.textContent = "Please add your name."; err.classList.add("show"); return; }
  if (!body.phone.trim() && !body.email.trim()) { err.textContent = "Please add a phone number or email so I can reach you."; err.classList.add("show"); return; }
  err.classList.remove("show"); btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = "Sending your request…";
  try {
    let r;
    if (current.type === "class") r = await api("book-class", { ...body, classId: current.item.id });
    else r = await api("book-slot", { ...body, slotId: current.item.id });
    showDone(r, body);
    f.reset(); selSlot = null; load(true);
  } catch (ex) {
    err.textContent = ex.message; err.classList.add("show");
    if (ex.status === 400) load(true);
  } finally { btn.disabled = false; btn.innerHTML = label; }
});

function showDone(r, body) {
  $("#mForm").hidden = true; $("#mDone").hidden = false;
  const first = (body.name || "").trim().split(/\s+/)[0];
  $("#mDoneTitle").textContent = r.already ? `You're already on the list${first ? ", " + first : ""}!` : `Thank you${first ? ", " + first : ""}! Your spot is on hold.`;
  const what = current.type === "class" ? `<b>${esc(r.title)}</b>` : `<b>${fmtDate(r.date, { weekday: "long", month: "long", day: "numeric" })} at ${fmtTime(r.time)}</b>`;
  $("#mPay").hidden = true;
  $("#mDoneText").innerHTML = `I'm holding your place for ${what}. I'll call you within a day for a short, friendly chat. Once we've talked and you're ready, I'll send you the link to complete payment.`;
  burst();
}
function burst() {
  const g = G(); const host = $("#mCheck"); const tick = $("#mTick");
  if (!g || reduce) return;
  const len = tick.getTotalLength(); g.fromTo(tick, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.7, delay: 0.15, ease: "power2.out" });
  g.from(host, { scale: 0.6, opacity: 0, duration: 0.6, ease: "power3.out" });
  return;
  const cols = [];
  for (let i = 0; i < 22; i++) {
    const p = document.createElement("i"); p.className = "burst"; p.style.background = cols[i % cols.length]; host.appendChild(p);
    const a = (i / 22) * Math.PI * 2, dist = 70 + Math.random() * 70;
    g.fromTo(p, { x: -6, y: -6, scale: 0, rotate: 0 }, { x: Math.cos(a) * dist, y: Math.sin(a) * dist, scale: 0.6 + Math.random(), rotate: Math.random() * 360, opacity: 0, duration: 1.4 + Math.random() * 0.6, ease: "expo.out", onComplete: () => p.remove() });
  }
}

/* ---------- load ---------- */
async function load(quiet) {
  try {
    state = await api("public");
    window.MAMANEW_SETTINGS = state.settings; window.dispatchEvent(new Event("mamanew:settings"));
    $$('[data-price="group"]').forEach((el) => (el.textContent = "$" + state.settings.groupPrice));
    $$('[data-price="private"]').forEach((el) => (el.textContent = "$" + state.settings.privatePrice));
    $("#demoNote").hidden = !isDemo();
    if (selDate && !slotsOn(selDate).length) { selDate = null; selSlot = null; }
    if (!quiet && state.slots.length) { const f = parseDate(state.slots[0].date); view = new Date(f.getFullYear(), f.getMonth(), 1); }
    renderClasses(); renderCal(); renderTimes();
  } catch (e) {
    $("#classGrid").innerHTML = `<div class="empty"><h3>Let's get you booked</h3><p>${esc(e.message)}</p><a class="btn" href="${WA()}" target="_blank" rel="noopener">Message on WhatsApp <span class="arr">→</span></a></div>`;
    $("#timeList").innerHTML = `<p class="muted">${esc(e.message)}</p>`;
    renderCal(); refreshST();
  }
}
moveInd();
load();
