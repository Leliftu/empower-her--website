"""Empower Her: Flask backend.

Run:  python app.py        (development)
Prod: gunicorn app:app
"""
import json
import os
import re
import sqlite3
from pathlib import Path

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = Path(os.environ.get("DB_PATH", DATA_DIR / "messages.db"))
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024  # reject large request bodies


def load_json(name):
    with open(DATA_DIR / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


LIBRARY = load_json("library")
READS = load_json("reads")
STORIES = load_json("stories")
ROADMAP = load_json("roadmap")
SCHOLARSHIPS = load_json("scholarships")
QUIZ = load_json("quiz")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------- database ----------
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with db() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"""
        )


# ---------- helpers ----------
def error(message, status=400):
    return jsonify({"error": message}), status


@app.after_request
def security_headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "SAMEORIGIN"
    resp.headers["Referrer-Policy"] = "same-origin"
    return resp


@app.errorhandler(404)
def not_found(_):
    if request.path.startswith("/api/"):
        return error("Not found", 404)
    return "Page not found", 404


@app.errorhandler(405)
def bad_method(_):
    return error("Method not allowed", 405)


@app.errorhandler(413)
def too_large(_):
    return error("Request too large", 413)


# ---------- pages ----------
@app.get("/")
def index():
    return render_template("index.html")


# ---------- content API ----------
@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/library")
def library():
    category = request.args.get("category", "all").lower()
    items = [x for x in LIBRARY if category == "all" or category in x["categories"]]
    return jsonify(items)


@app.get("/api/reads")
def reads():
    return jsonify(READS)


@app.get("/api/stories")
def stories():
    region = request.args.get("region", "all")
    q = request.args.get("q", "").strip().lower()[:80]
    items = [
        s for s in STORIES
        if (region == "all" or s["region"] == region)
        and (not q or q in f'{s["name"]} {s["country"]} {s["field"]}'.lower())
    ]
    return jsonify(items)


@app.get("/api/roadmap")
def roadmap():
    return jsonify(ROADMAP)


@app.get("/api/scholarships")
def scholarships():
    return jsonify(SCHOLARSHIPS)


# ---------- quiz (scoring happens on the server) ----------
@app.get("/api/quiz")
def quiz_questions():
    questions = [
        {"question": q["question"], "options": [o["text"] for o in q["options"]]}
        for q in QUIZ["questions"]
    ]
    return jsonify(questions)


@app.post("/api/quiz")
def quiz_result():
    body = request.get_json(silent=True) or {}
    answers = body.get("answers")
    questions = QUIZ["questions"]
    if not isinstance(answers, list) or len(answers) != len(questions):
        return error(f"Please answer all {len(questions)} questions.")
    order = list(QUIZ["categories"])
    tally = {k: 0 for k in order}
    for q, a in zip(questions, answers):
        if not isinstance(a, int) or isinstance(a, bool) or not 0 <= a < len(q["options"]):
            return error("Invalid answer.")
        tally[q["options"][a]["category"]] += 1
    top = sorted(order, key=lambda k: (-tally[k], order.index(k)))[:2]
    results = [
        {"key": k, "score": tally[k], **QUIZ["categories"][k]} for k in top
    ]
    return jsonify(results)


# ---------- contact ----------
@app.post("/api/contact")
def contact():
    body = request.get_json(silent=True) or {}
    name = str(body.get("name", "")).strip()
    email = str(body.get("email", "")).strip()
    message = str(body.get("message", "")).strip()
    if not name or not message:
        return error("Name and message are required.")
    if len(name) > 100 or len(email) > 150 or len(message) > 2000:
        return error("One of the fields is too long.")
    if email and not EMAIL_RE.match(email):
        return error("Please enter a valid email address.")
    with db() as conn:
        conn.execute(
            "INSERT INTO messages (name, email, message) VALUES (?, ?, ?)",
            (name, email, message),
        )
    return jsonify({"ok": True, "message": f"Thank you, {name}. Your message was received."}), 201


@app.get("/api/messages")
def messages():
    token = request.headers.get("X-Admin-Token", "")
    if not ADMIN_TOKEN or token != ADMIN_TOKEN:
        return error("Forbidden", 403)
    with db() as conn:
        rows = conn.execute("SELECT * FROM messages ORDER BY id DESC").fetchall()
    return jsonify([dict(r) for r in rows])


init_db()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1", port=int(os.environ.get("PORT", 5000)))
