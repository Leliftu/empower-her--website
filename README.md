# Empower Her

A website with free book links, 20 African women's biographies, a study abroad roadmap,
a scholarship guide, and a major-finder quiz. Backend: Python (Flask). Frontend: HTML, CSS, JavaScript.

## Run it
    python -m venv venv
    source venv/bin/activate        # Windows: venv\Scripts\activate
    pip install -r requirements.txt
    python app.py                   # open http://127.0.0.1:5000

Production: `gunicorn app:app`

## Structure
    app.py               Flask app: routes, quiz scoring, contact storage (SQLite)
    data/*.json          Editable content (stories, library, roadmap, scholarships, quiz)
    templates/index.html Page markup
    static/css/style.css Styles
    static/js/app.js     Frontend logic (calls the API)

## API
    GET  /api/library?category=all|self-help|psychology|education
    GET  /api/reads
    GET  /api/stories?region=all|eth|oth&q=text
    GET  /api/roadmap          GET /api/scholarships
    GET  /api/quiz             POST /api/quiz  {"answers":[0,2,1,...]}
    POST /api/contact          {"name","email","message"}
    GET  /api/messages         needs header X-Admin-Token equal to env ADMIN_TOKEN

## Edit content
Change the JSON files in `data/` and restart. Contact messages are saved in `data/messages.db`.
Environment variables: PORT, ADMIN_TOKEN, DB_PATH, FLASK_DEBUG=1.
