// Talks to the booking API. When the site is opened as a preview (not on the live site),
// it switches to a demo mode that keeps sample data in this browser only.
import * as core from "../shared/core.mjs";

const PREVIEW_HOST =
  location.protocol === "file:" ||
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
  /claude|claudeusercontent|anthropic/.test(location.hostname) ||
  new URLSearchParams(location.search).has("demo") ||
  window.MAMANEW_DEMO === true;

let demoMode = false;
export const isDemo = () => demoMode;

const KEY = "mamanew-demo-v1";
let mem = null;
function demoLoad() {
  if (mem) return mem;
  try { const s = localStorage.getItem(KEY); if (s) return (mem = core.normalize(JSON.parse(s))); } catch (e) {}
  mem = core.seedData(); demoSave(mem); return mem;
}
function demoSave(d) { mem = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
export function resetDemo() { mem = null; try { localStorage.removeItem(KEY); } catch (e) {} }

function fail(msg, status = 400) { const e = new Error(msg); e.status = status; return e; }

function demo(path, body, token) {
  const d = demoLoad(); let r;
  if (path === "public") r = core.publicView(d);
  else if (path === "book-class" || path === "book-slot" || path === "contact" || path === "freebie") {
    r = path === "book-class" ? core.bookClass(d, body) : path === "book-slot" ? core.bookSlot(d, body) : path === "freebie" ? core.addSubscriber(d, body) : core.addMessage(d, body);
    if (!r.error) demoSave(d);
  } else if (path === "login") r = body.password === "demo" ? { token: "demo" } : { error: 'In preview mode the password is "demo".' };
  else if (path === "admin") {
    if (token !== "demo") throw fail("Please log in again.", 401);
    if (body.action && body.action !== "get") { const x = core.adminAction(d, body); if (x && x.error) r = x; else demoSave(d); }
    r = r || { data: d };
  }
  if (!r) throw fail("Not found", 404);
  if (r.error) throw fail(r.error);
  return JSON.parse(JSON.stringify(r));
}

async function real(path, body, token) {
  const res = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!(res.headers.get("content-type") || "").includes("json")) throw new Error("no-api");
  const j = await res.json();
  if (!res.ok) throw fail(j.error || "Something went wrong.", res.status);
  return j;
}

export async function api(path, body, token) {
  if (demoMode) return demo(path, body, token);
  try { return await real(path, body, token); }
  catch (e) {
    if (e.status) throw e;
    if (PREVIEW_HOST) { demoMode = true; return demo(path, body, token); }
    throw fail("We couldn't reach the booking system right now. Please message on WhatsApp and we'll get you booked.", 0);
  }
}

/* ---------- formatting helpers ---------- */
export const parseDate = (s) => new Date(s + "T12:00:00");
export const fmtDate = (s, o = { weekday: "short", month: "short", day: "numeric" }) => (s ? parseDate(s).toLocaleDateString("en-US", o) : "");
export function fmtTime(t) {
  if (!t) return ""; let [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12;
  return h + (m ? ":" + String(m).padStart(2, "0") : "") + ap;
}
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
