import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { message, email } = req.body || {};
  if (!message || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const { error } = await supabase.from("feedback").insert({
    message: message.trim(),
    email: email || null,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
