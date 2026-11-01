"use strict";

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tags = (list) => list.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
const initials = (n) => n.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("");

async function api(path, options) {
  const res = await fetch(path, options);
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON response */ }
  if (!res.ok) throw new Error((data && data.error) || "Something went wrong. Please try again.");
  return data;
}
const showError = (el, msg) => { el.innerHTML = `<p class="note">${esc(msg)}</p>`; };

/* ---------- Free Library ---------- */
let libCat = "all";

async function renderLibrary() {
  const cats = ["all", "self-help", "psychology", "education"];
  $("libChips").innerHTML = cats
    .map((c) => `<button class="chip${c === libCat ? " on" : ""}" data-c="${c}">${c === "all" ? "All" : c[0].toUpperCase() + c.slice(1)}</button>`)
    .join("");
  try {
    const items = await api(`/api/library?category=${encodeURIComponent(libCat)}`);
    $("libGrid").innerHTML = items
      .map((x) => `<div class="card"><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><p>${tags(x.categories)}</p>
        <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Visit website →</a></div>`)
      .join("");
  } catch (e) { showError($("libGrid"), e.message); }
}

async function renderReads() {
  try {
    const items = await api("/api/reads");
    $("readGrid").innerHTML = items
      .map((r) => `<div class="card"><span class="tag">${esc(r.category)}</span><h3>${esc(r.title)}</h3><p>${esc(r.author)}</p>
        <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Find on ${esc(r.source)} →</a></div>`)
      .join("");
  } catch (e) { showError($("readGrid"), e.message); }
}

/* ---------- Stories ---------- */
let region = "all";
let searchTimer;

async function renderStories() {
  const q = $("storySearch").value.trim();
  try {
    const items = await api(`/api/stories?region=${region}&q=${encodeURIComponent(q)}`);
    $("storyGrid").innerHTML = items.length
      ? items.map((s) => `<div class="card story">
          <div class="avatar${s.region === "eth" ? " eth" : ""}">${esc(initials(s.name))}</div>
          <h3>${esc(s.name)}</h3>
          <p>${tags([s.country, s.field])}</p>
          <p>${esc(s.summary)}</p>
          <p><b>Challenge:</b> ${esc(s.challenge)}</p>
          <p><b>Lesson:</b> ${esc(s.lesson)}</p>
          <details><summary>Read full biography</summary><p>${esc(s.bio)}</p></details></div>`).join("")
      : "<p>No stories match your search.</p>";
  } catch (e) { showError($("storyGrid"), e.message); }
}

document.querySelectorAll("[data-r]").forEach((b) =>
  b.addEventListener("click", () => {
    region = b.dataset.r;
    document.querySelectorAll("[data-r]").forEach((x) => x.classList.toggle("on", x === b));
    renderStories();
  })
);
$("storySearch").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderStories, 250);
});
$("libChips").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) { libCat = b.dataset.c; renderLibrary(); }
});

/* ---------- Roadmap (progress is saved in this browser) ---------- */
const KEY = "empowerher-steps";
let done = {};
try { done = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { done = {}; }
const saveDone = () => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) { /* storage unavailable */ } };

function updateProgress(total) {
  const n = Object.keys(done).length;
  const p = total ? Math.round((n / total) * 100) : 0;
  $("progText").textContent = `${p}% complete (${n} of ${total} steps)`;
  $("progBar").style.width = p + "%";
}

async function renderRoadmap() {
  try {
    const stages = await api("/api/roadmap");
    let total = 0;
    $("steps").innerHTML = stages
      .map((s, i) => `<details${i === 0 ? " open" : ""}><summary>${esc(s.title)}</summary><ul>${s.steps
        .map((t, j) => { total++; const id = `${i}-${j}`;
          return `<li><label><input type="checkbox" data-id="${id}"${done[id] ? " checked" : ""}> <span>${esc(t)}</span></label></li>`; })
        .join("")}</ul></details>`)
      .join("");
    // drop saved ids that no longer exist
    const valid = new Set([...$("steps").querySelectorAll("[data-id]")].map((x) => x.dataset.id));
    Object.keys(done).forEach((k) => { if (!valid.has(k)) delete done[k]; });
    updateProgress(total);
    $("steps").onchange = (e) => {
      const id = e.target.dataset.id;
      if (!id) return;
      if (e.target.checked) done[id] = true; else delete done[id];
      saveDone();
      updateProgress(total);
    };
  } catch (e) { showError($("steps"), e.message); }
}

async function renderScholarships() {
  try {
    const items = await api("/api/scholarships");
    $("schol").innerHTML = items.map((s) => `<div class="card"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></div>`).join("");
  } catch (e) { showError($("schol"), e.message); }
}

/* ---------- Quiz (scored by the backend) ---------- */
async function renderQuiz() {
  try {
    const questions = await api("/api/quiz");
    $("quiz").innerHTML = questions
      .map((q, i) => `<div class="q"><p>${i + 1}. ${esc(q.question)}</p>${q.options
        .map((o, j) => `<label><input type="radio" name="q${i}" value="${j}"> ${esc(o)}</label>`).join("")}</div>`)
      .join("");
    $("quizBtn").onclick = async () => {
      const answers = questions.map((_, i) => {
        const r = document.querySelector(`input[name="q${i}"]:checked`);
        return r ? Number(r.value) : null;
      });
      const missing = answers.filter((a) => a === null).length;
      if (missing) {
        $("result").innerHTML = `<p><strong>Please answer all ${questions.length} questions.</strong> ${missing} left.</p>`;
        return;
      }
      try {
        const results = await api("/api/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        });
        $("result").innerHTML = `<h3>Your top matches</h3><div class="grid">${results
          .map((c, idx) => `<div class="card"><span class="tag">${idx === 0 ? "Best match" : "Also strong"}</span>
            <h3>${esc(c.name)}</h3><p>${esc(c.description)}</p>
            <p><b>Career paths:</b></p><p>${tags(c.careers)}</p>
            <p><b>Majors to explore:</b></p><p>${tags(c.majors)}</p></div>`).join("")}</div>
          <div class="card" style="margin-top:16px"><h3>Try this month</h3><p>Talk to one woman working in this field, read one free book about it from the Free Library, and complete one small project to test whether you enjoy the work.</p></div>`;
        $("result").scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) { showError($("result"), e.message); }
    };
  } catch (e) { showError($("quiz"), e.message); }
}

/* ---------- Contact ---------- */
$("cBtn").addEventListener("click", async () => {
  const out = $("cOut");
  const btn = $("cBtn");
  const payload = { name: $("cName").value, email: $("cMail").value, message: $("cMsg").value };
  btn.disabled = true;
  out.textContent = "Sending…";
  try {
    const res = await api("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    out.textContent = res.message;
    ["cName", "cMail", "cMsg"].forEach((id) => { $(id).value = ""; });
  } catch (e) { out.textContent = e.message; }
  btn.disabled = false;
});

/* ---------- start ---------- */
$("yr").textContent = new Date().getFullYear();
renderLibrary();
renderReads();
renderStories();
renderRoadmap();
renderScholarships();
renderQuiz();
