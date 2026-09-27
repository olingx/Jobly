# yoworkly

Search once, see how many listings exist and exactly which sources they came
from. Now with filters, sorting, saved-search email alerts, and feedback
collection.

## What's in this version

- `public/index.html` — search UI with remote/location/nonprofit filters and
  sort (relevance, newest, salary)
- `api/search.js` — aggregates RemoteOK + Arbeitnow, filters/sorts, cached at
  Vercel's edge for 30 min per unique search
- `api/subscribe.js` — saves an email + search as an alert subscription
- `api/feedback.js` — stores feedback messages
- `api/check-alerts.js` — runs daily via Vercel Cron, emails subscribers when
  their saved search has new matches
- `lib/jobs.js` — shared fetching/filtering/sorting logic used by both search
  and the alert cron

## One-time setup (in addition to the original Vercel deploy)

### 1. Create a free Supabase project
- supabase.com -> sign up -> "New Project"
- Once created, go to the SQL editor and run:

```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  query text not null,
  remote boolean default false,
  location text,
  nonprofit boolean default false,
  seen_urls jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  email text,
  created_at timestamptz default now()
);
```

- Go to Project Settings -> API -> copy your Project URL and service_role
  key (not the anon key -- this needs full access from the server)

### 2. Create a free EmailJS account (for sending alert emails, no domain needed)
- emailjs.com -> sign up
- Add an Email Service -> connect your personal Gmail/Outlook account -> note
  the Service ID
- Create an Email Template with variables {{to_email}}, {{subject}},
  {{jobs_html}} in the body -> note the Template ID
- Account -> General -> copy your Public Key
- Account -> Security -> enable "Allow API calls from non-browser
  applications" and copy your Private Key
- Free tier: 200 emails/month -- fine for early testing, upgrade later if it
  grows

### 3. Add environment variables in Vercel
Project -> Settings -> Environment Variables, add:
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- EMAILJS_SERVICE_ID
- EMAILJS_TEMPLATE_ID
- EMAILJS_PUBLIC_KEY
- EMAILJS_PRIVATE_KEY
- CRON_SECRET -- make up any random string yourself; Vercel automatically
  sends it as a Bearer token when triggering your cron job, and
  check-alerts.js checks for it

Redeploy after adding these (Vercel usually prompts you to).

## How the alert flow works

1. Someone searches, then enters their email and taps "Email me new matches"
2. That gets saved to Supabase via /api/subscribe
3. Once a day, Vercel Cron hits /api/check-alerts, which re-runs every
   saved search against fresh job data
4. Any listing URL not seen before gets emailed, then marked as seen so it's
   not sent again

## Feedback

The "Have feedback? Tell us" link at the bottom prompts for a message and
saves it to the feedback table in Supabase -- view submissions anytime in
the Supabase dashboard's Table Editor.

## Known limits to know about

- EmailJS free tier caps at 200 emails/month -- if you get real usage, you'll
  hit this before anything else
- Vercel's free Cron only supports daily-or-less-frequent schedules, so
  alerts are checked once a day, not instantly
- Nonprofit/NGO filtering is keyword-based (checks for words like
  "nonprofit," "ngo," "charity" in the listing) since the job APIs don't have
  a structured field for this -- it'll miss some and occasionally over-match
