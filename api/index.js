// Mamanew booking API — runs as a Vercel Function.
// Storage: Upstash Redis (Vercel → Storage → Upstash Redis → connect to this project).
// Required env var: ADMIN_PASSWORD (Vercel → Project → Settings → Environment Variables).
import { Redis } from "@upstash/redis";
import crypto from "node:crypto";
import * as core from "../shared/core.mjs";

const KEY = "mamanew:data";
let redis;
function db() {
  if (!redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw Object.assign(new Error("Storage isn't connected yet. In Vercel, add an Upstash Redis database to this project."), { expose: true });
    redis = new Redis({ url, token });
  }
  return redis;
}
const load = async () => core.normalize(await db().get(KEY));
const save = (d) => db().set(KEY, d);

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const secret = () => process.env.TOKEN_SECRET || process.env.ADMIN_PASSWORD || "";
const sign = (exp) => crypto.createHmac("sha256", secret()).update("mamanew:" + exp).digest("hex");
const makeToken = () => { const exp = Date.now() + 12 * 3600e3; return exp + "." + sign(exp); };
function verify(t) {
  if (!t || !secret()) return false;
  const [exp, sig] = t.split(".");
  if (!exp || !sig || +exp < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function routeOf(req) {
  const u = new URL(req.url);
  return (u.searchParams.get("route") || u.pathname.replace(/^\/api\/?/, "").replace(/^index\/?/, "")).replace(/\/$/, "");
}

// Optional: email the freebie automatically. Set RESEND_API_KEY and MAIL_FROM (e.g. "Chana at Mamanew <hello@mamanew.com>")
// in Vercel's environment variables. Without them, the download simply opens on the page.
async function sendFreebie(r, origin) {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) return false;
  const e = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const link = `${origin}/${r.file}`, first = e((r.name || "").split(/\s+/)[0]);
  const html = `<div style="font-family:Georgia,serif;color:#2E4535;max-width:520px;margin:auto;padding:24px;background:#FBF7F2">
    <p style="font-size:18px">Hi${first ? " " + first : ""},</p>
    <p style="font-size:16px;line-height:1.6">Thank you for downloading <b>${r.title}</b>. Here's your copy:</p>
    <p><a href="${link}" style="display:inline-block;background:#A65E61;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-family:Arial,sans-serif;font-size:15px">Download ${r.title}</a></p>
    <p style="font-size:16px;line-height:1.6">If you have any questions about preparing for birth, I'd love to talk. You can schedule a free call at <a href="${origin}/#contact" style="color:#A65E61">mamanew</a> or call 845.642.6230.</p>
    <p style="font-size:16px">Warmly,<br>Chana<br><span style="color:#5C665E;font-size:14px">Mamanew · ICEA Certified Childbirth Educator</span></p></div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [r.email], subject: `Your free ${r.title} from Mamanew`, html }) });
    return res.ok;
  } catch (e) { console.error(e); return false; }
}

async function handle(req) {
  const route = routeOf(req);
  try {
    if (req.method === "GET" && route === "public") return json(core.publicView(await load()));
    if (req.method !== "POST") return json({ error: "Not found" }, 404);
    const body = await req.json().catch(() => ({}));

    if (route === "freebie") {
      const d = await load();
      const r = core.addSubscriber(d, body);
      if (r.error) return json(r, 400);
      if (r.file) await save(d);
      r.emailed = r.file ? await sendFreebie(r, new URL(req.url).origin) : false;
      return json(r);
    }

    if (route === "book-class" || route === "book-slot" || route === "contact") {
      const d = await load();
      const r = route === "book-class" ? core.bookClass(d, body) : route === "book-slot" ? core.bookSlot(d, body) : core.addMessage(d, body);
      if (r.error) return json(r, 400);
      if (!r.already) await save(d);
      return json(r);
    }

    if (route === "login") {
      const pw = process.env.ADMIN_PASSWORD;
      if (!pw) return json({ error: "The admin password isn't set up yet. Add ADMIN_PASSWORD in Vercel's environment variables, then redeploy." }, 500);
      if (!same(body.password || "", pw)) { await new Promise((r) => setTimeout(r, 900)); return json({ error: "That password isn't right." }, 401); }
      return json({ token: makeToken() });
    }

    if (route === "admin") {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (!verify(token)) return json({ error: "Please log in again." }, 401);
      const d = await load();
      if (body.action && body.action !== "get") {
        const r = core.adminAction(d, body);
        if (r && r.error) return json(r, 400);
        await save(d);
      }
      return json({ data: d });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: e.expose ? e.message : "Something went wrong. Please try again." }, 500);
  }
}

export const GET = handle;
export const POST = handle;
