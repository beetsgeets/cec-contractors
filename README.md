# CEC Contractors website

The public site for CEC Contractors (ceccontractors.com) with a built-in admin
for posting jobs from a phone and editing the site's text in place.

## Running it

```
npm install
npm start            # http://localhost:3000
```

On first start with an empty database it loads the 19 initial jobs and photos
from `seed/`. Data (SQLite database + uploaded photos) lives in `./data` locally
and on the persistent disk (`/data`) on Render.

Environment variables (all optional locally):

| Variable | What it is |
| --- | --- |
| `DATA_DIR` | Folder for the database and photos (`/data` on Render) |
| `SITE_URL` | Public address, used for links in emails and the sitemap |
| `SESSION_SECRET` | Long random string that signs the login cookie |
| `RESEND_API_KEY` | Resend API key for sending estimate-request emails |
| `MAIL_FROM` | From address for those emails (domain must be verified in Resend) |
| `MAIL_TO` | Comma-separated recipients (admin Settings page overrides this) |

## Where things are

- `server.js` — starts the app (and seeds on first run)
- `src/app.js` — Express setup; `src/routes/public.js` — the site; `src/routes/admin.js` — the admin
- `src/lib/content.js` — every editable piece of site copy with its default text
- `src/lib/images.js` — photo processing (sharp): large / medium / thumb, EXIF stripped
- `views/` — EJS templates; `public/` — CSS, JS, logo files
- `seed/jobs.json` — the initial jobs; `seed/prep_photos.py` regenerates `seed/uploads` from the original photo folders
- `test/admintest.js` — end-to-end check of the admin in a phone-sized browser

## Admin

`/admin` — first visit creates the first owner login. From there: post jobs,
reorder photos, pick covers, write captions, see estimate requests, change
phone numbers and emails, add a second login. While signed in, every public
page gets an "Edit this page's text" button for click-to-edit copy.

## Deploying

`render.yaml` describes the Render setup: a Starter web service with a 1 GB
disk at `/data`. Pushing to `main` redeploys. The `RESEND_API_KEY` is entered
in the Render dashboard, never committed.
