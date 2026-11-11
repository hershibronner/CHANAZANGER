// Mamanew booking logic — shared by the Vercel function (server) and the preview/demo mode (browser).
// Pure functions: they take the data object, change it, and return a result.

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const clip = (v, n = 200) => String(v ?? "").trim().slice(0, n);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const isTime = (s) => /^\d{2}:\d{2}$/.test(s || "");

export function todayNY(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

export function emptyData() {
  return { classes: [], slots: [], messages: [], subscribers: [], settings: { payGroup: "", payPrivate: "", groupPrice: 400, privatePrice: 750 } };
}

export function normalize(d) {
  d = d && typeof d === "object" ? d : {};
  d.classes = Array.isArray(d.classes) ? d.classes : [];
  d.slots = Array.isArray(d.slots) ? d.slots : [];
  d.messages = Array.isArray(d.messages) ? d.messages : [];
  d.subscribers = Array.isArray(d.subscribers) ? d.subscribers : [];
  d.settings = Object.assign(emptyData().settings, d.settings || {});
  d.classes.forEach((c) => (c.signups = Array.isArray(c.signups) ? c.signups : []));
  return d;
}

const lastDay = (c) => c.endDate || c.startDate;
const sortClasses = (a, b) => (a.startDate + (a.time || "")).localeCompare(b.startDate + (b.time || ""));
const sortSlots = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);

/* ---------- what the public website sees (no personal info) ---------- */
export function publicView(d, now = Date.now()) {
  const today = todayNY(now);
  const classes = d.classes
    .filter((c) => !c.hidden && lastDay(c) >= today && c.startDate >= today)
    .sort(sortClasses)
    .map((c) => {
      const cap = +c.capacity || 5;
      const spotsLeft = Math.max(0, cap - c.signups.length);
      return {
        id: c.id, title: c.title, startDate: c.startDate, endDate: c.endDate || "", time: c.time || "",
        schedule: c.schedule || "", location: c.location || "", notes: c.notes || "",
        price: +c.price || d.settings.groupPrice, capacity: cap, spotsLeft, full: spotsLeft === 0, closed: !!c.closed || spotsLeft === 0,
      };
    });
  const slots = d.slots.filter((s) => !s.booked && s.date >= today).sort(sortSlots).map((s) => ({ id: s.id, date: s.date, time: s.time, duration: s.duration || "" }));
  return { classes, slots, settings: { payGroup: d.settings.payGroup, payPrivate: d.settings.payPrivate, groupPrice: d.settings.groupPrice, privatePrice: d.settings.privatePrice } };
}

function person(b) {
  const p = { name: clip(b.name, 80), email: clip(b.email, 120), phone: clip(b.phone, 40), due: clip(b.due, 40), notes: clip(b.notes, 600) };
  if (!p.name) return { error: "Please add your name." };
  if (!p.email && !p.phone) return { error: "Please add a phone number or email so Chana can reach you." };
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return { error: "That email doesn't look quite right." };
  return p;
}

/* ---------- public bookings ---------- */
export function bookClass(d, b, now = Date.now()) {
  const c = d.classes.find((x) => x.id === b.classId);
  if (!c || c.hidden || c.startDate < todayNY(now)) return { error: "That class isn't available anymore." };
  const p = person(b); if (p.error) return p;
  if (p.email && c.signups.some((s) => s.email && s.email.toLowerCase() === p.email.toLowerCase()))
    return { ok: true, already: true, payLink: d.settings.payGroup, price: +c.price || d.settings.groupPrice, title: c.title };
  if (c.closed) return { error: "Registration for this class is closed." };
  if (c.signups.length >= (+c.capacity || 5)) return { error: "So sorry, this class just filled up! Message on WhatsApp to join the waitlist." };
  c.signups.push({ id: uid(), ...p, paid: false, createdAt: new Date(now).toISOString() });
  return { ok: true, payLink: d.settings.payGroup, price: +c.price || d.settings.groupPrice, title: c.title };
}

export function bookSlot(d, b, now = Date.now()) {
  const s = d.slots.find((x) => x.id === b.slotId);
  if (!s || s.date < todayNY(now)) return { error: "That time isn't available anymore." };
  if (s.booked) return { error: "So sorry, someone just booked that time. Please pick another one." };
  const p = person(b); if (p.error) return p;
  s.booked = { ...p, paid: false, createdAt: new Date(now).toISOString() };
  return { ok: true, payLink: d.settings.payPrivate, price: d.settings.privatePrice, date: s.date, time: s.time };
}

/* ---------- contact form ---------- */
export function addMessage(d, b, now = Date.now()) {
  if (clip(b["bot-field"])) return { ok: true }; // spam trap
  const p = person(b); if (p.error) return p;
  d.messages.unshift({ id: uid(), ...p, interest: clip(b.interest, 80), message: clip(b.message, 2000), read: false, createdAt: new Date(now).toISOString() });
  d.messages = d.messages.slice(0, 500);
  return { ok: true };
}

/* ---------- freebies ---------- */
export const FREEBIES = {
  affirmations: { title: "50 Birth Affirmation Cards", file: "freebies/Mamanew_Birth_Affirmation_Cards.pdf" },
  checklist: { title: "The Hospital Bag Checklist", file: "freebies/Mamanew_Hospital_Bag_Checklist.pdf" },
};
export function addSubscriber(d, b, now = Date.now()) {
  if (clip(b["bot-field"])) return { ok: true, file: "" };
  const f = FREEBIES[b.freebie];
  if (!f) return { error: "That freebie isn't available." };
  const email = clip(b.email, 120).toLowerCase(), name = clip(b.name, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };
  const when = new Date(now).toISOString();
  let s = d.subscribers.find((x) => x.email === email);
  if (!s) { s = { id: uid(), email, name, freebies: [], newsletter: false, createdAt: when }; d.subscribers.unshift(s); }
  if (name) s.name = name;
  if (!s.freebies.includes(b.freebie)) s.freebies.push(b.freebie);
  if (b.newsletter === true || b.newsletter === "on" || b.newsletter === "true") s.newsletter = true;
  s.updatedAt = when;
  d.subscribers = d.subscribers.slice(0, 5000);
  return { ok: true, file: f.file, title: f.title, name: s.name, email };
}

/* ---------- admin actions ---------- */
export function adminAction(d, a) {
  const findClass = (id) => d.classes.find((c) => c.id === id);
  switch (a.action) {
    case "saveClass": {
      const x = a.cls || {};
      if (!isDate(x.startDate)) return { error: "Please choose a start date." };
      const fields = {
        title: clip(x.title, 100) || "Group Birth Preparation Class",
        startDate: x.startDate, endDate: isDate(x.endDate) ? x.endDate : "",
        time: isTime(x.time) ? x.time : "", schedule: clip(x.schedule, 160), location: clip(x.location, 160),
        notes: clip(x.notes, 400), capacity: Math.max(1, Math.min(50, parseInt(x.capacity) || 5)),
        price: Math.max(0, parseInt(x.price) || d.settings.groupPrice), closed: !!x.closed, hidden: !!x.hidden,
      };
      const c = x.id && findClass(x.id);
      if (c) Object.assign(c, fields); else d.classes.push({ id: uid(), ...fields, signups: [] });
      return { ok: true };
    }
    case "deleteClass": d.classes = d.classes.filter((c) => c.id !== a.id); return { ok: true };
    case "toggleClass": { const c = findClass(a.id); if (c) c[a.field === "hidden" ? "hidden" : "closed"] = !!a.value; return { ok: true }; }
    case "addSignup": {
      const c = findClass(a.classId); if (!c) return { error: "Class not found." };
      const p = person(a.person || {}); if (p.error) return p;
      c.signups.push({ id: uid(), ...p, paid: !!(a.person || {}).paid, createdAt: new Date().toISOString(), addedByAdmin: true });
      return { ok: true };
    }
    case "setPaid": {
      const c = findClass(a.classId); const s = c && c.signups.find((x) => x.id === a.signupId);
      if (s) s.paid = !!a.paid; return { ok: true };
    }
    case "removeSignup": { const c = findClass(a.classId); if (c) c.signups = c.signups.filter((x) => x.id !== a.signupId); return { ok: true }; }
    case "addSlots": {
      if (!isDate(a.date)) return { error: "Please choose a date." };
      const times = (a.times || []).filter(isTime);
      if (!times.length) return { error: "Please add at least one time." };
      times.forEach((t) => { if (!d.slots.some((s) => s.date === a.date && s.time === t)) d.slots.push({ id: uid(), date: a.date, time: t, duration: clip(a.duration, 40), booked: null }); });
      d.slots.sort(sortSlots); return { ok: true };
    }
    case "deleteSlot": d.slots = d.slots.filter((s) => s.id !== a.id); return { ok: true };
    case "freeSlot": { const s = d.slots.find((x) => x.id === a.id); if (s) s.booked = null; return { ok: true }; }
    case "slotPaid": { const s = d.slots.find((x) => x.id === a.id); if (s && s.booked) s.booked.paid = !!a.paid; return { ok: true }; }
    case "bookSlotAdmin": {
      const s = d.slots.find((x) => x.id === a.id); if (!s) return { error: "Time not found." };
      const p = person(a.person || {}); if (p.error) return p;
      s.booked = { ...p, paid: !!(a.person || {}).paid, createdAt: new Date().toISOString(), addedByAdmin: true }; return { ok: true };
    }
    case "readMessage": { const m = d.messages.find((x) => x.id === a.id); if (m) m.read = a.read !== false; return { ok: true }; }
    case "deleteMessage": d.messages = d.messages.filter((x) => x.id !== a.id); return { ok: true };
    case "deleteSubscriber": d.subscribers = d.subscribers.filter((x) => x.id !== a.id); return { ok: true };
    case "setNewsletter": { const s = d.subscribers.find((x) => x.id === a.id); if (s) s.newsletter = !!a.value; return { ok: true }; }
    case "saveSettings": {
      const s = a.settings || {};
      const url = (u) => { u = clip(u, 500); return !u || /^https?:\/\//i.test(u) ? u : "https://" + u; };
      d.settings.payGroup = url(s.payGroup); d.settings.payPrivate = url(s.payPrivate);
      d.settings.groupPrice = Math.max(0, parseInt(s.groupPrice) || 400); d.settings.privatePrice = Math.max(0, parseInt(s.privatePrice) || 750);
      return { ok: true };
    }
    default: return { error: "Unknown action." };
  }
}

/* ---------- sample data, used only in preview/demo mode ---------- */
export function seedData(now = Date.now()) {
  const d = emptyData();
  const day = (n) => todayNY(now + n * 864e5);
  d.classes.push(
    { id: uid(), title: "Winter Group Series", startDate: day(9), endDate: day(30), time: "19:30", schedule: "4 Tuesday evenings · 7:30–9:30pm", location: "Monsey, NY", notes: "", capacity: 5, price: 400, closed: false, hidden: false,
      signups: [ { id: uid(), name: "Sample Mom", email: "sample@example.com", phone: "", due: "March", notes: "", paid: true, createdAt: new Date(now).toISOString() },
                 { id: uid(), name: "Another Sample", email: "", phone: "845-000-0000", due: "April", notes: "", paid: false, createdAt: new Date(now).toISOString() } ] },
    { id: uid(), title: "Spring Group Series", startDate: day(45), endDate: day(66), time: "20:00", schedule: "4 Wednesday evenings · 8–10pm", location: "Monsey, NY", notes: "", capacity: 5, price: 400, closed: false, hidden: false, signups: [] },
    { id: uid(), title: "Weekend Intensive", startDate: day(20), endDate: day(21), time: "10:00", schedule: "Sunday & Monday · 10am–3pm", location: "Monsey, NY", notes: "", capacity: 5, price: 400, closed: false, hidden: false,
      signups: Array.from({ length: 5 }, (_, i) => ({ id: uid(), name: "Sample " + (i + 1), email: "", phone: "845-000-000" + i, due: "", notes: "", paid: true, createdAt: new Date(now).toISOString() })) }
  );
  [3, 4, 7, 11, 12, 18, 25].forEach((n, i) => ["10:00", "13:00", "19:30"].forEach((t, j) => {
    if ((i + j) % 3 === 2) return;
    d.slots.push({ id: uid(), date: day(n), time: t, duration: "2 hours", booked: (i === 1 && j === 0) ? { name: "Sample Private", email: "", phone: "845-000-1111", due: "May", notes: "", paid: false, createdAt: new Date(now).toISOString() } : null });
  }));
  d.subscribers.push({ id: uid(), email: "sample.mom@example.com", name: "Sample Mom", freebies: ["checklist", "affirmations"], newsletter: true, createdAt: new Date(now).toISOString() },
    { id: uid(), email: "another@example.com", name: "Another Sample", freebies: ["checklist"], newsletter: false, createdAt: new Date(now - 864e5).toISOString() });
  d.messages.push({ id: uid(), name: "Sample Visitor", email: "visitor@example.com", phone: "", due: "June", notes: "", interest: "Free consultation", message: "Hi! I'm expecting my first and would love to hear more about the private classes.", read: false, createdAt: new Date(now).toISOString() });
  return d;
}
