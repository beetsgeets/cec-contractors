# CEC Contractors — Website

This is a **custom static website** (HTML, CSS, JavaScript) for **CEC Contractors**, with **Supabase** for editable text, services, portfolio images, and a **password-protected admin dashboard**. The public site does **not** require login.

**Who this guide is for:** Michael (or anyone setting up the project the first time). Follow the steps in order. If you get stuck, ask whoever helps you with “Supabase” or “Netlify” to read the **Technical notes** at the bottom.

---

## What you get

- **Public pages:** `index.html`, `about.html`, `services.html`, `portfolio.html`, `contact.html`
- **Contact form:** uses **Formspree** (you paste your own form ID)
- **Admin:** `admin.html` (login) and `dashboard.html` (edit content, portfolio, services)
- **Styling:** `css/style.css`
- **Scripts:** `js/main.js` (public site), `js/admin.js` (admin), `js/supabase-client.js`, `js/config.js` (your Supabase URL and **anon** key only)

**Important:** Never put the Supabase **service role** secret key in any file that loads in the browser. Only the **anon** public key belongs in `js/config.js` (or in Netlify environment variables for build).

---

## Step 1 — Configure Supabase keys (local computer)

1. Open the project folder on your computer.
2. Open **`js/config.js`** in a text editor (if you removed it, copy **`js/config.example.js`** to **`js/config.js`** first).
3. Replace the two placeholders with your real values from Supabase (you will get these in Step 3):
   - `url` — looks like `https://roryrokffilemghhskct.supabase.co`
   - `anonKey` — long string labeled **anon public** in Supabase

Save the file.

---

## Step 2 — Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **New project**, choose a name and database password, and pick a region close to Ohio.
3. Wait until the project finishes provisioning.

---

## Step 3 — Get your API URL and anon key

1. In the Supabase dashboard, open your project.
2. Go to **Project Settings** (gear icon) → **API**.
3. Copy:
   - **Project URL** → paste into `js/config.js` as `url`
   - **anon public** key → paste into `js/config.js` as `anonKey`

---

## Step 4 — Run the database SQL (tables + security)

1. In Supabase, open **SQL Editor**.
2. Click **New query**.
3. Paste the **entire** script below and click **Run**.

This creates tables, turns on **Row Level Security (RLS)**, and sets policies so:

- **Visitors (anonymous)** can only **read** public content (and read portfolio images from storage).
- **Logged-in staff** (Michael and Matt) can **read, add, change, and delete** content and upload images.

```sql
-- ---- Tables ----
-- (Uses gen_random_uuid(); if your database errors here, run once:
--   create extension if not exists "pgcrypto";
-- )

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  page text not null,
  section text not null,
  content_key text not null,
  content_value text,
  updated_at timestamptz default now(),
  unique (page, section, content_key)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon_class text default 'fas fa-wrench',
  order_index int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text not null,
  category text,
  order_index int not null default 0,
  created_at timestamptz default now()
);

-- ---- Row Level Security ----
alter table public.site_content enable row level security;
alter table public.services enable row level security;
alter table public.portfolio_items enable row level security;

-- site_content: anyone can read; only signed-in users can write
create policy "site_content_select_anon"
  on public.site_content for select
  to anon
  using (true);

create policy "site_content_select_authenticated"
  on public.site_content for select
  to authenticated
  using (true);

create policy "site_content_insert_authenticated"
  on public.site_content for insert
  to authenticated
  with check (true);

create policy "site_content_update_authenticated"
  on public.site_content for update
  to authenticated
  using (true)
  with check (true);

create policy "site_content_delete_authenticated"
  on public.site_content for delete
  to authenticated
  using (true);

-- services
create policy "services_select_anon"
  on public.services for select
  to anon
  using (true);

create policy "services_select_authenticated"
  on public.services for select
  to authenticated
  using (true);

create policy "services_insert_authenticated"
  on public.services for insert
  to authenticated
  with check (true);

create policy "services_update_authenticated"
  on public.services for update
  to authenticated
  using (true)
  with check (true);

create policy "services_delete_authenticated"
  on public.services for delete
  to authenticated
  using (true);

-- portfolio_items
create policy "portfolio_select_anon"
  on public.portfolio_items for select
  to anon
  using (true);

create policy "portfolio_select_authenticated"
  on public.portfolio_items for select
  to authenticated
  using (true);

create policy "portfolio_insert_authenticated"
  on public.portfolio_items for insert
  to authenticated
  with check (true);

create policy "portfolio_update_authenticated"
  on public.portfolio_items for update
  to authenticated
  using (true)
  with check (true);

create policy "portfolio_delete_authenticated"
  on public.portfolio_items for delete
  to authenticated
  using (true);
```

If Supabase reports that a policy already exists, you can drop it by name and re-run, or skip the duplicate lines.

---

## Step 5 — Storage bucket for portfolio images

1. In Supabase go to **Storage**.
2. Create a new bucket named exactly: **`portfolio-images`**
3. Turn **Public bucket** **ON** (so image URLs work on the public website).

**Alternative:** If you prefer SQL for the bucket record, run once in **SQL Editor** (then still set the bucket to **public** in the UI if needed):

```sql
insert into storage.buckets (id, name, public)
values ('portfolio-images', 'portfolio-images', true)
on conflict (id) do update set public = excluded.public;
```

Then run this in the **SQL Editor** so staff can upload and everyone can view:

```sql
-- Allow public read of objects in this bucket
create policy "Public read portfolio-images"
  on storage.objects for select
  using (bucket_id = 'portfolio-images');

-- Authenticated users can upload / replace / delete
create policy "Authenticated insert portfolio-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portfolio-images');

create policy "Authenticated update portfolio-images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'portfolio-images')
  with check (bucket_id = 'portfolio-images');

create policy "Authenticated delete portfolio-images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'portfolio-images');
```

*(If Supabase shows errors about duplicate policies, remove the old policy first from **Storage → Policies** or adjust names.)*

---

## Step 6 — Seed starter text and services (optional but recommended)

Run in **SQL Editor** to match the `data-site-content` fields in the HTML (`page|section|key`):

```sql
insert into public.site_content (page, section, content_key, content_value) values
  ('home', 'hero', 'headline', 'Built for detail. Trusted in Northeast Ohio.'),
  ('home', 'hero', 'subtitle', 'CEC Contractors delivers high-end finish work, careful restoration, and dependable contracting across Cuyahoga & Lake counties — building on decades of family craftsmanship.'),
  ('home', 'hero', 'cta_primary', 'Get a Free Estimate'),
  ('home', 'highlights', 'heading', 'Why homeowners & businesses choose us'),
  ('home', 'highlights', 'lead', 'Licensed and insured, with clear communication from estimate to punch list.'),
  ('home', 'highlights', 'card1_title', 'Finish that lasts'),
  ('home', 'highlights', 'card1_body', 'Trim, built-ins, and stair details executed with patience and precision.'),
  ('home', 'highlights', 'card2_title', 'Restoration respect'),
  ('home', 'highlights', 'card2_body', 'Historical fabric treated thoughtfully — repairs that belong in the room.'),
  ('home', 'highlights', 'card3_title', 'Coordinated crews'),
  ('home', 'highlights', 'card3_body', 'Commercial and residential schedules kept on track with trusted trade partners.'),
  ('about', 'intro', 'lead', 'We are a family-rooted contracting company: formerly Cutting Edge Carpentry, now CEC Contractors — building on 25 years of family craftsmanship with a fresh name and the same standards.'),
  ('about', 'story', 'body', '<p>CEC Contractors continues a legacy of honest work and meticulous job sites. For <strong>25 years combined</strong> our team has refined trim, restoration, and commercial interiors; we have operated as <strong>CEC Contractors</strong> for <strong>four years</strong>, pairing modern scheduling with old-school pride in the fit and finish.</p><p><em>CEC Carpentry</em> may appear on older estimates or references — it reflects the same crew and values you have trusted for years.</p>'),
  ('about', 'team', 'body', '<p><strong>Michael Mishaga</strong> — pricing, estimates, and day-to-day client care. Phone <a href="tel:+12163093631">216-309-3631</a>. Email <a href="mailto:mike@cutting-edgecarpentry.com">mike@cutting-edgecarpentry.com</a></p><p><strong>Matt Mishaga</strong> — field leadership and project coordination. Email <a href="mailto:matt@cutting-edgecarpentry.com">matt@cutting-edgecarpentry.com</a></p>'),
  ('about', 'credentials', 'note', 'Licensed and insured. References available on request.'),
  ('services', 'intro', 'lead', 'From intricate trim to full coordination on larger builds — finish carpentry, restoration, commercial work, general contracting, and vetted trade partners.'),
  ('portfolio', 'intro', 'lead', 'Selected finish, restoration, and commercial work. Images and copy are managed from the admin dashboard.'),
  ('contact', 'intro', 'lead', 'Tell us about your project, timeline, and location — we will respond with clear next steps.'),
  ('global', 'footer', 'tagline', 'Northeast Ohio · Licensed & insured · Finish · Restoration · Contracting')
on conflict (page, section, content_key) do update
  set content_value = excluded.content_value,
      updated_at = now();

insert into public.services (title, description, icon_class, order_index) values
  ('High-end finish carpentry', 'Custom mouldings, built-ins, stair parts, and meticulous trim for homes and boutique commercial spaces.', 'fas fa-ruler-combined', 0),
  ('Historical restoration', 'Sensitive repairs and period-appropriate details for older homes and civic buildings.', 'fas fa-landmark', 1),
  ('Commercial contracting', 'Offices, storefronts, and tenant improvements with schedules that respect your operations.', 'fas fa-building', 2),
  ('General contracting', 'Single-point coordination from layout to punch list with clear communication.', 'fas fa-hard-hat', 3),
  ('Trade connections', 'Trusted partners for electrical, plumbing, HVAC, and specialists when the job needs a full team.', 'fas fa-handshake', 4);
```

Run the `services` insert **once**. If you run it again you will get duplicate rows — delete extras from **Table Editor** if needed.

---

## Step 7 — Create two staff logins (Supabase Auth)

Supabase already includes an **`auth.users`** table. You do **not** need a separate `users` table for login.

1. In Supabase go to **Authentication** → **Users**.
2. Click **Add user** → **Create new user**.
3. Create **Michael’s** email and a strong password. Repeat for **Matt**.
4. (Optional) Turn on **Confirm email** in **Authentication → Providers → Email**; if it is on, use **Auto-confirm** when creating users from the dashboard so they can sign in immediately.

Staff sign in at **`/admin.html`** on your site.

---

## Step 8 — Formspree (contact form)

1. Create a free form at [https://formspree.io](https://formspree.io).
2. Open `contact.html` and find the form tag.
3. Replace `YOURFORMID` in  
   `https://formspree.io/f/YOURFORMID`  
   with your real Formspree ID.

---

## Step 9 — Allowed URLs in Supabase (production + local testing)

1. Supabase → **Authentication** → **URL Configuration**.
2. Under **Site URL**, set your main live address (for example your Netlify URL).
3. Under **Redirect URLs**, add:
   - Your Netlify site URL (e.g. `https://your-site.netlify.app`)
   - Local dev URLs you use, for example:
     - `http://127.0.0.1:5500` (VS Code Live Server)
     - `http://localhost:5500`
     - `http://localhost:5173` (if you use Vite or similar)

This reduces “redirect not allowed” errors after login.

---

## Step 10 — Test on your computer

1. Install **Live Server** in VS Code (or any static local server).
2. Open the project folder and start Live Server on **`index.html`**.
3. Confirm pages load. After Step 3–4, text and lists should load from Supabase.
4. Open **`admin.html`**, sign in, open **`dashboard.html`**, make a small text change, save, reload the public home page — you should see the update (or wait up to about two minutes for the automatic refresh while the tab stays open).

---

## Deploying to Netlify (free)

### Option A — Drag and drop

1. Zip the project folder (include `css`, `js`, all `.html` files).
2. Go to [https://app.netlify.com](https://app.netlify.com) → **Add new site** → **Deploy manually**.
3. Upload the zip.

**Note:** The included `netlify.toml` runs `node scripts/build-config.js` during **Git-based** deploys. For drag-and-drop, either:

- Build `js/config.js` on your machine **before** zipping (paste real keys into `config.js` for that zip — only for private zips), **or**
- Remove / rename `netlify.toml` for drag-and-drop and rely on `js/config.js` inside the zip.

### Option B — Git + environment variables (recommended)

1. Push the project to GitHub (without committing real keys if the repo is public — use Netlify env vars instead).
2. In Netlify: **Add new site** → **Import an existing project** → connect the repo.
3. Netlify reads **`netlify.toml`**:
   - **Build command:** `node scripts/build-config.js`
   - **Publish directory:** `.` (site root)
4. In Netlify: **Site settings → Environment variables → Build** — add:
   - `SUPABASE_URL` = your project URL  
   - `SUPABASE_ANON_KEY` = your anon public key  
5. Deploy. Netlify will write **`js/config.js`** during the build. Do **not** commit real keys to Git if the repo is public.

---

## Project layout

```
cec-contractors/
├── index.html
├── about.html
├── services.html
├── portfolio.html
├── contact.html
├── admin.html
├── dashboard.html
├── netlify.toml
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── config.js          ← local keys (or generated on Netlify)
│   ├── config.example.js  ← template
│   ├── supabase-client.js
│   ├── main.js
│   └── admin.js
└── scripts/
    └── build-config.js    ← Netlify: writes js/config.js from env
```

---

## Technical notes

- **Supabase JS v2** is loaded from the CDN URL listed in the HTML files.
- **`getSupabaseClient()`** lives in `js/supabase-client.js` and is used by both `main.js` and `admin.js`.
- **Public site** polls Supabase about every **2 minutes** and also refetches when you return to the tab, so edits show up without always hard-refreshing.
- **Dashboard** requires an active session; otherwise you are sent to `admin.html`.
- **HTML in `site_content`:** The public site sets `innerHTML` for matching elements. Only trusted staff should edit those fields.

---

## Support checklist

| Problem | What to check |
|--------|----------------|
| “Unable to load content” | `js/config.js` URL/key correct; RLS `SELECT` for `anon` on all three tables |
| Login fails | User exists under **Authentication → Users**; email provider enabled |
| Upload fails | Bucket name **`portfolio-images`**; storage policies; user is logged in |
| Form does not email | Formspree URL in `contact.html` |

---

© Setup instructions for CEC Contractors. Branding: **CEC Contractors** (legacy references may mention **CEC Carpentry** / Cutting Edge Carpentry).
