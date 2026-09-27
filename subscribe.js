import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, query, remote, location, nonprofit } = req.body || {};
  if (!email || !query) {
    res.status(400).json({ error: "email and query are required" });
    return;
  }

  const { error } = await supabase.from("subscriptions").insert({
    email,
    query,
    remote: !!remote,
    location: location || null,
    nonprofit: !!nonprofit,
    seen_urls: [],
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
