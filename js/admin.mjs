import { api, isDemo, resetDemo, fmtDate, fmtTime, parseDate, esc } from "./api.mjs";
import { todayNY } from "../shared/core.mjs";

const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const TK = "mamanew-admin-token";
let token = null, data = null, view = "classes";
try { token = sessionStorage.getItem(TK); } catch (e) {}

/* ---------- helpers ---------- */
let tt;
function toast(msg, bad) { const t = $("#toast"); t.textContent = msg; t.classList.toggle("bad", !!bad); t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 3000); }
const today = () => todayNY();

/* in-page confirmation (works everywhere, nicer on phones) */
function ask(msg, okLabel = "Yes, continue") {
  return new Promise((res) => {
    const sh = $("#askSheet"); $("#askMsg").textContent = msg; $("#askOk").textContent = okLabel;
    const done = (v) => { sh.classList.remove("open"); $("#askOk").onclick = null; sh.onclick = null; res(v); };
    $("#askOk").onclick = () => done(true);
    sh.onclick = (e) => { if (e.target.closest("[data-close]")) done(false); };
    sh.classList.add("open");
  });
}
const icon = { x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>' };

async function act(body, msg) {
  document.body.classList.add("loading");
  try {
    const r = await api("admin", body, token);
    data = r.data; render(); if (msg) toast(msg); return true;
  } catch (e) {
    if (e.status === 401) return logout(e.message);
    toast(e.message, true); return false;
  } finally { document.body.classList.remove("loading"); }
}

/* ---------- login ---------- */
$("#pwShow").addEventListener("click", () => { const i = $("#pw"); i.type = i.type === "password" ? "text" : "password"; $("#pwShow").textContent = i.type === "password" ? "Show" : "Hide"; });
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const btn = $("#loginBtn"), err = $("#loginErr");
  btn.disabled = true; btn.textContent = "Logging in…"; err.hidden = true;
  try {
    const r = await api("login", { password: $("#pw").value });
    token = r.token; try { sessionStorage.setItem(TK, token); } catch (e) {}
    await start();
  } catch (ex) { err.textContent = ex.message; err.hidden = false; $("#demoHint").hidden = !isDemo(); }
  finally { btn.disabled = false; btn.textContent = "Log in"; }
});
function logout(msg) {
  token = null; try { sessionStorage.removeItem(TK); } catch (e) {}
  $("#app").hidden = true; $("#login").hidden = false; $("#pw").value = "";
  if (msg) { $("#loginErr").textContent = msg; $("#loginErr").hidden = false; }
}
$("#logout").addEventListener("click", () => logout());
$("#resetDemo").addEventListener("click", async () => { resetDemo(); await act({ action: "get" }, "Sample data reset"); });

async function start() {
  const r = await api("admin", { action: "get" }, token);
  data = r.data; $("#login").hidden = true; $("#app").hidden = false; $("#demoBar").hidden = !isDemo(); render();
}

/* ---------- tabs ---------- */
$$(".tab").forEach((t) => t.addEventListener("click", () => {
  view = t.dataset.view; $$(".tab").forEach((x) => x.classList.toggle("on", x === t));
  $$(".view").forEach((v) => (v.hidden = v.id !== "v-" + view)); scrollTo({ top: 0, behavior: "smooth" });
}));

/* ---------- render ---------- */
function render() { renderClasses(); renderSlots(); renderMessages(); renderSubscribers(); renderSettings(); }

function classCard(c, past) {
  const cap = +c.capacity || 5, n = c.signups.length, full = n >= cap, unpaid = c.signups.filter((s) => !s.paid).length;
  const d = parseDate(c.startDate);
  const range = c.endDate && c.endDate !== c.startDate ? `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : fmtDate(c.startDate, { weekday: "long", month: "long", day: "numeric" });
  const badges = [
    full ? '<span class="badge full">Full</span>' : !c.closed && !c.hidden ? '<span class="badge">Open</span>' : "",
    c.closed ? '<span class="badge closed">Registration closed</span>' : "",
    c.hidden ? '<span class="badge hidden">Hidden from site</span>' : "",
    unpaid ? `<span class="badge unpaid">${unpaid} unpaid</span>` : "",
  ].join("");
  const people = c.signups.length
    ? c.signups.map((s) => `
      <div class="person">
        <div class="nm">${esc(s.name)}<small>${s.due ? "Due " + esc(s.due) + " · " : ""}Signed up ${fmtDate(s.createdAt.slice(0, 10), { month: "short", day: "numeric" })}${s.addedByAdmin ? " · added by you" : ""}</small></div>
        <div class="ct">${s.phone ? `<a href="tel:${esc(s.phone)}">${esc(s.phone)}</a>` : ""}${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ""}</div>
        <label class="switch"><input type="checkbox" data-paid="${c.id}|${s.id}" ${s.paid ? "checked" : ""}><em>${s.paid ? "Paid" : "Unpaid"}</em></label>
        <button class="icon-btn" title="Remove from class" data-rm="${c.id}|${s.id}" data-nm="${esc(s.name)}">${icon.x}</button>
        ${s.notes ? `<p class="note">"${esc(s.notes)}"</p>` : ""}
      </div>`).join("")
    : '<p class="none">No sign-ups yet.</p>';
  return `<article class="ccard">
    <div class="ccard-top">
      <div class="cdate"><small>${d.toLocaleDateString("en-US", { month: "short" })}</small><b>${d.getDate()}</b></div>
      <div><div class="ctitle">${esc(c.title)}</div><div class="cmeta">${esc(range)}${c.schedule ? " · " + esc(c.schedule) : ""}${c.location ? " · " + esc(c.location) : ""} · $${c.price}</div><div class="badges">${badges}</div></div>
      <div class="cap"><b>${n}/${cap}</b><small>${full ? "full" : cap - n + " spots left"}</small><div class="bar"><i style="width:${Math.min(100, (n / cap) * 100)}%"></i></div></div>
    </div>
    ${past ? "" : `<div class="ccard-actions">
      <button class="btn ghost sm" data-edit="${c.id}">Edit</button>
      <button class="btn ghost sm" data-toggle="${c.id}" data-field="closed" data-val="${!c.closed}">${c.closed ? "Reopen registration" : "Close registration"}</button>
      <button class="btn ghost sm" data-toggle="${c.id}" data-field="hidden" data-val="${!c.hidden}">${c.hidden ? "Show on site" : "Hide from site"}</button>
      <button class="btn danger sm" data-del="${c.id}" data-nm="${esc(c.title)}">Delete</button>
    </div>`}
    <div class="people">
      <div class="people-head"><span>Sign-ups (${n})</span><span class="acts">
        ${n ? `<button class="btn ghost sm" data-copy="${c.id}">Copy contacts</button>` : ""}
        <button class="btn soft sm" data-addp="${c.id}">+ Add person</button></span></div>
      ${people}
    </div>
  </article>`;
}

function renderClasses() {
  const t = today();
  const sorted = [...data.classes].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const up = sorted.filter((c) => (c.endDate || c.startDate) >= t), past = sorted.filter((c) => (c.endDate || c.startDate) < t).reverse();
  const signups = up.reduce((n, c) => n + c.signups.length, 0), unpaid = up.reduce((n, c) => n + c.signups.filter((s) => !s.paid).length, 0);
  $("#stats").innerHTML = `<div class="stat"><b>${up.length}</b><span>Upcoming classes</span></div><div class="stat"><b>${signups}</b><span>Moms signed up</span></div><div class="stat ${unpaid ? "warn" : ""}"><b>${unpaid}</b><span>Waiting on payment</span></div>`;
  $("#classList").innerHTML = up.length ? up.map((c) => classCard(c)).join("") : `<div class="empty"><div class="d">No upcoming classes</div>Tap <b>+ New class</b> to post your next group series.</div>`;
  $("#pastWrap").hidden = !past.length; $("#pastList").innerHTML = past.map((c) => classCard(c, true)).join("");
}

function slotRow(s, past) {
  const b = s.booked;
  return `<div class="slot">
    <div class="t">${fmtTime(s.time)}${s.duration ? `<small>${esc(s.duration)}</small>` : ""}</div>
    <div class="who">${b ? `<b>${esc(b.name)}</b>${b.due ? ` · due ${esc(b.due)}` : ""}<br>${b.phone ? `<a href="tel:${esc(b.phone)}">${esc(b.phone)}</a>` : ""}${b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : ""}${b.notes ? `<br><i style="color:var(--ink-soft)">"${esc(b.notes)}"</i>` : ""}` : '<span class="open">Open</span>'}</div>
    <div class="acts">${b
      ? `<label class="switch"><input type="checkbox" data-spaid="${s.id}" ${b.paid ? "checked" : ""}><em>${b.paid ? "Paid" : "Unpaid"}</em></label>${past ? "" : `<button class="btn ghost sm" data-free="${s.id}" data-nm="${esc(b.name)}">Free up</button>`}`
      : past ? "" : `<button class="btn soft sm" data-sbook="${s.id}">Book someone</button>`}
      ${past && b ? "" : `<button class="icon-btn" title="Delete this time" data-sdel="${s.id}">${icon.x}</button>`}</div>
  </div>`;
}
function groupSlots(list, past) {
  const by = {}; list.forEach((s) => (by[s.date] = by[s.date] || []).push(s));
  return Object.keys(by).sort((a, b) => (past ? b.localeCompare(a) : a.localeCompare(b))).map((d) => {
    const n = by[d].filter((s) => s.booked).length;
    return `<div class="day-group"><h4>${fmtDate(d, { weekday: "long", month: "long", day: "numeric" })}<small>${n} booked · ${by[d].length - n} open</small></h4>${by[d].sort((a, b) => a.time.localeCompare(b.time)).map((s) => slotRow(s, past)).join("")}</div>`;
  }).join("");
}
function renderSlots() {
  const t = today();
  const up = data.slots.filter((s) => s.date >= t), past = data.slots.filter((s) => s.date < t && s.booked);
  $("#slotList").innerHTML = up.length ? groupSlots(up) : `<div class="empty"><div class="d">No open times yet</div>Add a date and a few start times above. They'll appear on the website's calendar right away.</div>`;
  $("#pastSlotsWrap").hidden = !past.length; $("#pastSlots").innerHTML = groupSlots(past, true);
  const booked = up.filter((s) => s.booked).length; const c = $("#privCount"); c.hidden = !booked; c.textContent = booked;
}
function renderMessages() {
  const list = data.messages || [], unread = list.filter((m) => !m.read).length;
  const c = $("#msgCount"); c.hidden = !unread; c.textContent = unread;
  $("#msgList").innerHTML = list.length ? list.map((m) => `
    <article class="msg ${m.read ? "" : "unread"}">
      <div class="msg-top"><div><b>${esc(m.name)}</b><small>${new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${m.interest ? " · " + esc(m.interest) : ""}${m.due ? " · due " + esc(m.due) : ""}</small></div>
        <div class="msg-acts"><button class="btn ghost sm" data-mread="${m.id}" data-val="${!m.read}">${m.read ? "Mark unread" : "Mark read"}</button><button class="icon-btn" title="Delete message" data-mdel="${m.id}" data-nm="${esc(m.name)}">${icon.x}</button></div></div>
      ${m.message ? `<p class="msg-body">${esc(m.message)}</p>` : ""}
      <div class="msg-ct">${m.phone ? `<a href="tel:${esc(m.phone)}">${esc(m.phone)}</a>` : ""}${m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ""}</div>
    </article>`).join("") : `<div class="empty"><div class="d">No messages yet</div>When someone fills out the contact form, it shows up here.</div>`;
}
const FREEBIE_NAMES = { affirmations: "Affirmation cards", checklist: "Hospital bag checklist" };
function renderSubscribers() {
  const list = data.subscribers || [], news = list.filter((x) => x.newsletter).length;
  const week = list.filter((x) => Date.now() - new Date(x.createdAt) < 7 * 864e5).length;
  const c = $("#subCount"); c.hidden = !list.length; c.textContent = list.length;
  $("#subStats").innerHTML = `<div class="stat"><b>${list.length}</b><span>Total subscribers</span></div><div class="stat"><b>${news}</b><span>On the newsletter</span></div><div class="stat"><b>${week}</b><span>New this week</span></div>`;
  $("#subList").innerHTML = list.length ? list.map((x) => `
    <div class="sub">
      <div><b>${esc(x.name || "No name")}</b><small><a href="mailto:${esc(x.email)}" style="color:inherit">${esc(x.email)}</a></small></div>
      <div class="fb">${(x.freebies || []).map((f) => `<span class="badge">${esc(FREEBIE_NAMES[f] || f)}</span>`).join("")}<small style="align-self:center">${fmtDate((x.createdAt || "").slice(0, 10), { month: "short", day: "numeric" })}</small></div>
      <label class="switch"><input type="checkbox" data-subnews="${x.id}" ${x.newsletter ? "checked" : ""}><em>${x.newsletter ? "Newsletter" : "No newsletter"}</em></label>
      <button class="icon-btn" title="Delete subscriber" data-subdel="${x.id}" data-nm="${esc(x.email)}">${icon.x}</button>
    </div>`).join("") : `<div class="empty"><div class="d">No subscribers yet</div>When someone downloads a freebie from your site, they'll show up here.</div>`;
}
function renderSettings() {
  const f = $("#setForm"); ["groupPrice", "privatePrice", "payGroup", "payPrivate"].forEach((k) => { if (document.activeElement !== f[k]) f[k].value = data.settings[k] ?? ""; });
}

/* ---------- class actions ---------- */
const sheet = (id, open) => $(id).classList.toggle("open", open);
$$(".sheet").forEach((s) => s.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) s.classList.remove("open"); }));
addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".sheet.open").forEach((s) => s.classList.remove("open")); });

function openClass(c) {
  const f = $("#classForm"); f.reset(); $("#csErr").hidden = true;
  $("#csTitle").textContent = c ? "Edit class" : "New class";
  const v = c || { capacity: 5, price: data.settings.groupPrice, location: "" };
  ["id", "title", "startDate", "endDate", "schedule", "time", "location", "capacity", "price", "notes"].forEach((k) => (f[k].value = v[k] ?? ""));
  f.closed.checked = !!v.closed; f.hidden.checked = !!v.hidden;
  sheet("#classSheet", true); setTimeout(() => f.title.focus(), 300);
}
$("#newClass").addEventListener("click", () => openClass(null));
$("#csSave").addEventListener("click", async () => {
  const f = $("#classForm"); const cls = Object.fromEntries(new FormData(f)); cls.closed = f.closed.checked; cls.hidden = f.hidden.checked;
  if (!cls.startDate) { $("#csErr").textContent = "Please choose the first class date."; $("#csErr").hidden = false; return; }
  if (cls.endDate && cls.endDate < cls.startDate) { $("#csErr").textContent = "The last date is before the first date."; $("#csErr").hidden = false; return; }
  const c = data.classes.find((x) => x.id === cls.id);
  if (c && +cls.capacity < c.signups.length && !(await ask(`${c.signups.length} moms are already signed up, which is more than ${cls.capacity} spots. Save anyway?`, "Save anyway"))) return;
  if (await act({ action: "saveClass", cls }, cls.id ? "Class updated" : "Class posted ✿")) sheet("#classSheet", false);
});

let personTarget = null;
function openPerson(target, title) {
  personTarget = target; $("#personForm").reset(); $("#psErr").hidden = true; $("#psTitle").textContent = title;
  sheet("#personSheet", true); setTimeout(() => $("#personForm").name.focus(), 300);
}
$("#psSave").addEventListener("click", async () => {
  const f = $("#personForm"); const person = Object.fromEntries(new FormData(f)); person.paid = f.paid.checked;
  if (!person.name.trim()) { $("#psErr").textContent = "Please add a name."; $("#psErr").hidden = false; return; }
  const body = personTarget.type === "class" ? { action: "addSignup", classId: personTarget.id, person } : { action: "bookSlotAdmin", id: personTarget.id, person };
  if (await act(body, "Added")) sheet("#personSheet", false);
});

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-edit],[data-toggle],[data-del],[data-rm],[data-addp],[data-copy],[data-free],[data-sdel],[data-sbook],[data-mread],[data-mdel],[data-subdel],[data-subcopy]");
  if (!el) return;
  const ds = el.dataset;
  if (ds.edit) openClass(data.classes.find((c) => c.id === ds.edit));
  else if (ds.toggle) act({ action: "toggleClass", id: ds.toggle, field: ds.field, value: ds.val === "true" }, "Saved");
  else if (ds.del) { const c = data.classes.find((x) => x.id === ds.del); if (await ask(`Delete "${ds.nm}"?${c && c.signups.length ? ` Its ${c.signups.length} sign-ups will be deleted too.` : ""}`, "Delete class")) act({ action: "deleteClass", id: ds.del }, "Class deleted"); }
  else if (ds.rm) { const [classId, signupId] = ds.rm.split("|"); if (await ask(`Remove ${ds.nm} from this class? Her spot will open up on the website.`, "Remove")) act({ action: "removeSignup", classId, signupId }, "Removed"); }
  else if (ds.addp) openPerson({ type: "class", id: ds.addp }, "Add someone to this class");
  else if (ds.copy) {
    const c = data.classes.find((x) => x.id === ds.copy);
    const txt = c.signups.map((s) => [s.name, s.phone, s.email].filter(Boolean).join(" · ")).join("\n");
    try { await navigator.clipboard.writeText(txt); toast("Contacts copied"); } catch (_) { await ask(txt, "Done"); }
  }
  else if (ds.free) { if (await ask(`Free up this time? ${ds.nm}'s booking will be removed and the time will show as open again.`, "Free up time")) act({ action: "freeSlot", id: ds.free }, "Time is open again"); }
  else if (ds.sdel) { const s = data.slots.find((x) => x.id === ds.sdel); if (!s.booked || await ask(`${s.booked.name} has booked this time. Delete it anyway?`, "Delete time")) act({ action: "deleteSlot", id: ds.sdel }, "Time removed"); }
  else if (ds.sbook) openPerson({ type: "slot", id: ds.sbook }, "Book someone into this time");
  else if (ds.subdel) { if (await ask(`Remove ${ds.nm} from your subscribers?`, "Remove")) act({ action: "deleteSubscriber", id: ds.subdel }, "Subscriber removed"); }
  else if (ds.subcopy) {
    const list = (data.subscribers || []).filter((x) => ds.subcopy === "all" || x.newsletter).map((x) => x.email);
    if (!list.length) return toast("No emails to copy yet", true);
    const txt = list.join(", ");
    try { await navigator.clipboard.writeText(txt); toast(`${list.length} email${list.length > 1 ? "s" : ""} copied`); } catch (_) { await ask(txt, "Done"); }
  }
  else if (ds.mread) act({ action: "readMessage", id: ds.mread, read: ds.val === "true" });
  else if (ds.mdel) { if (await ask(`Delete the message from ${ds.nm}?`, "Delete message")) act({ action: "deleteMessage", id: ds.mdel }, "Message deleted"); }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.paid) { const [classId, signupId] = t.dataset.paid.split("|"); t.nextElementSibling.textContent = t.checked ? "Paid" : "Unpaid"; act({ action: "setPaid", classId, signupId, paid: t.checked }, t.checked ? "Marked as paid ✓" : "Marked as unpaid"); }
  if (t.dataset.subnews) { t.nextElementSibling.textContent = t.checked ? "Newsletter" : "No newsletter"; act({ action: "setNewsletter", id: t.dataset.subnews, value: t.checked }, "Saved"); }
  if (t.dataset.spaid) { t.nextElementSibling.textContent = t.checked ? "Paid" : "Unpaid"; act({ action: "slotPaid", id: t.dataset.spaid, paid: t.checked }, t.checked ? "Marked as paid ✓" : "Marked as unpaid"); }
});

/* ---------- private times ---------- */
let times = [];
const dEl = $("#slotDate"); dEl.min = today();
function renderChips() {
  times.sort();
  $("#timeChips").innerHTML = times.map((t) => `<span class="chip">${fmtTime(t)}<button type="button" data-rmt="${t}" aria-label="Remove">×</button></span>`).join("");
  $("#slotHint").textContent = times.length && dEl.value ? `${times.length} time${times.length > 1 ? "s" : ""} on ${fmtDate(dEl.value, { weekday: "long", month: "long", day: "numeric" })}` : "";
}
function addTime(t) { if (t && !times.includes(t)) times.push(t); renderChips(); }
$("#addTime").addEventListener("click", () => { addTime($("#slotTime").value); $("#slotTime").value = ""; });
$("#slotTime").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#addTime").click(); } });
$$(".quick button").forEach((b) => b.addEventListener("click", () => addTime(b.dataset.q)));
$("#timeChips").addEventListener("click", (e) => { const b = e.target.closest("[data-rmt]"); if (b) { times = times.filter((t) => t !== b.dataset.rmt); renderChips(); } });
dEl.addEventListener("change", renderChips);
$("#saveSlots").addEventListener("click", async () => {
  if ($("#slotTime").value) addTime($("#slotTime").value);
  if (!dEl.value) return toast("Pick a date first", true);
  if (!times.length) return toast("Add at least one start time", true);
  if (await act({ action: "addSlots", date: dEl.value, times, duration: $("#slotDur").value }, "Times added to your calendar ✿")) { times = []; $("#slotTime").value = ""; renderChips(); }
});

/* ---------- settings ---------- */
$("#setForm").addEventListener("submit", (e) => { e.preventDefault(); act({ action: "saveSettings", settings: Object.fromEntries(new FormData(e.target)) }, "Saved"); });

/* ---------- boot ---------- */
if (token) start().catch(() => logout());
else { api("public").then(() => { $("#demoHint").hidden = !isDemo(); }).catch(() => {}); }
