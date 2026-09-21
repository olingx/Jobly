// Vercel serverless function: /api/search?q=your+query
// Aggregates job listings from free, no-key-required APIs.

export default async function handler(req, res) {
  const q = (req.query.q || "").trim();
  if (!q) {
    res.status(400).json({ error: "Missing query param 'q'" });
    return;
  }

  const terms = q.toLowerCase().split(/\s+/);

  const matches = (text) => {
    const t = (text || "").toLowerCase();
    return terms.some((term) => t.includes(term));
  };

  const [remoteok, arbeitnow] = await Promise.allSettled([
    fetchRemoteOK(matches),
    fetchArbeitnow(matches),
  ]);

  const sources = [];
  let total = 0;

  if (remoteok.status === "fulfilled") {
    sources.push(remoteok.value);
    total += remoteok.value.count;
  } else {
    sources.push({ source: "RemoteOK", count: 0, items: [], error: true });
  }

  if (arbeitnow.status === "fulfilled") {
    sources.push(arbeitnow.value);
    total += arbeitnow.value.count;
  } else {
    sources.push({ source: "Arbeitnow", count: 0, items: [], error: true });
  }

  res.status(200).json({ query: q, total, sources });
}

async function fetchRemoteOK(matches) {
  const r = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "jobly-app" },
  });
  const data = await r.json();
  // First element is a legal/notice object, not a job — skip it.
  const jobs = Array.isArray(data) ? data.slice(1) : [];
  const filtered = jobs.filter((j) =>
    matches(`${j.position} ${j.company} ${(j.tags || []).join(" ")}`)
  );
  return {
    source: "RemoteOK",
    count: filtered.length,
    items: filtered.slice(0, 25).map((j) => ({
      title: j.position,
      company: j.company,
      location: j.location || "Remote",
      url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
    })),
  };
}

async function fetchArbeitnow(matches) {
  const r = await fetch("https://www.arbeitnow.com/api/job-board-api");
  const data = await r.json();
  const jobs = Array.isArray(data.data) ? data.data : [];
  const filtered = jobs.filter((j) =>
    matches(`${j.title} ${j.company_name} ${(j.tags || []).join(" ")}`)
  );
  return {
    source: "Arbeitnow",
    count: filtered.length,
    items: filtered.slice(0, 25).map((j) => ({
      title: j.title,
      company: j.company_name,
      location: j.location || (j.remote ? "Remote" : ""),
      url: j.url,
    })),
  };
}
