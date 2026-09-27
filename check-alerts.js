// Triggered daily by Vercel Cron (see vercel.json). Vercel automatically sends
// "Authorization: Bearer <CRON_SECRET>" on cron-triggered requests when a
// CRON_SECRET env var is set, which is what we check below.
import { createClient } from "@supabase/supabase-js";
import { fetchAllJobs, filterJobs } from "../lib/jobs.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { data: subs, error } = await supabase.from("subscriptions").select("*");
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const { jobs } = await fetchAllJobs();
  let emailsSent = 0;

  for (const sub of subs) {
    const terms = sub.query.toLowerCase().split(/\s+/);
    const matched = filterJobs(jobs, {
      terms,
      remoteOnly: sub.remote,
      locationFilter: (sub.location || "").toLowerCase(),
      nonprofitOnly: sub.nonprofit,
    });

    const seen = new Set(sub.seen_urls || []);
    const fresh = matched.filter((j) => !seen.has(j.url));

    if (fresh.length > 0) {
      await sendAlertEmail(sub.email, sub.query, fresh);
      emailsSent++;
      const updatedSeen = [...seen, ...fresh.map((j) => j.url)].slice(-500);
      await supabase.from("subscriptions").update({ seen_urls: updatedSeen }).eq("id", sub.id);
    }
  }

  res.status(200).json({ checked: subs.length, emailsSent });
}

async function sendAlertEmail(to, query, jobs) {
  const listHtml = jobs
    .slice(0, 10)
    .map((j) => `<li><a href="${j.url}">${j.title}</a> — ${j.company}</li>`)
    .join("");

  // EmailJS sends through your own connected Gmail/Outlook account, so no
  // domain verification is needed. Requires "Allow API calls from
  // non-browser applications" enabled in EmailJS account security settings.
  await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY,
      template_params: {
        to_email: to,
        subject: `${jobs.length} new job(s) matching "${query}"`,
        jobs_html: listHtml,
      },
    }),
  });
}
