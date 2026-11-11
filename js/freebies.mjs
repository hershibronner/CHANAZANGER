// Freebies: email signup → saved to admin → instant download (and emailed, if email sending is set up).
import { api, esc } from "./api.mjs";
const $ = (s, c = document) => c.querySelector(s);
const modal = $("#freeModal");
const TITLES = { affirmations: "50 Birth Affirmation Cards", checklist: "The Hospital Bag Checklist" };
let current = null, lastFocus = null;

function open(id) {
  current = id; lastFocus = document.activeElement;
  $("#freeTitle").textContent = TITLES[id];
  $("#freeFormWrap").hidden = false; $("#freeDone").hidden = true; $("#freeErr").classList.remove("show");
  modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
  window.__lenis && window.__lenis.stop(); document.documentElement.style.overflow = "hidden";
  setTimeout(() => $("#fr-name").focus(), 300);
}
function close() {
  modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
  window.__lenis && window.__lenis.start(); document.documentElement.style.overflow = "";
  lastFocus && lastFocus.focus && lastFocus.focus();
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-freebie]"); if (b) open(b.dataset.freebie); });
modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) close(); });

$("#freeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, err = $("#freeErr"), btn = $("#freeSubmit");
  const body = Object.fromEntries(new FormData(f));
  body.newsletter = $("#fr-news").checked; body.freebie = current;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || "")) { err.textContent = "Please enter a valid email address."; err.classList.add("show"); return; }
  err.classList.remove("show"); btn.disabled = true; const label = btn.innerHTML; btn.textContent = "Getting your download…";
  try {
    const r = await api("freebie", body);
    const first = (body.name || "").trim().split(/\s+/)[0];
    $("#freeDoneTitle").textContent = `It's yours${first ? ", " + first : ""}!`;
    $("#freeDoneText").innerHTML = (r.emailed ? `I've also emailed a copy to <b>${esc(body.email)}</b>. ` : "") +
      (body.newsletter ? "Thank you for joining the newsletter. " : "") + "I hope it helps you feel a little more ready.";
    const dl = $("#freeDl"); dl.href = r.file; dl.setAttribute("download", r.file.split("/").pop());
    $("#freeFormWrap").hidden = true; $("#freeDone").hidden = false;
    f.reset();
  } catch (ex) { err.textContent = ex.message; err.classList.add("show"); }
  finally { btn.disabled = false; btn.innerHTML = label; }
});
