// Vercel serverless function: /api/search?q=...&remote=true&location=...&nonprofit=true&sort=newest|salary|relevance
// Aggregates job listings from free, no-key-required APIs.

const NONPROFIT_KEYWORDS = ["nonprofit", "non-profit", "ngo", "charity", "foundation"];

export default async function handler(req, res) {
  const q = (req.query.q || "").trim();
  if (!q) {
    res.status(400).json({ error: "Missing query param 'q'" });
    return;
  }

  const terms = q.toLowerCase().split(/\s+/);
  const remoteOnly = req.query.remote === "true";
  const locationFilter = (req.query.location || "").trim().toLowerCase();
  const nonprofitOnly = req.query.nonprofit === "true";
  const sort = req.query.sort || "relevance"; // relevance | newest | salary

  const [remoteok, arbeitnow] = await Promise.allSettled([
    fetchRemoteOK(),
    fetchArbeitnow(),
  ]);

  const sources = [];
  let total = 0;

  for (const [name, result] of [
    ["RemoteOK", remoteok],
    ["Arbeitnow", arbeitnow],
  ]) {
    if (result.status !== "fulfilled") {
      sources.push({ source: name, count: 0, items: [], error: true });
      continue;
    }

    let jobs = result.value.filter((j) => {
      const haystack = `${j.title} ${j.company} ${(j.tags || []).join(" ")}`.toLowerCase();
      if (!terms.some((t) => haystack.includes(t))) return false;
      if (remoteOnly && !j.remote) return false;
      if (locationFilter && !(j.location || "").toLowerCase().includes(locationFilter)) return false;
      if (nonprofitOnly && !NONPROFIT_KEYWORDS.some((k) => haystack.includes(k))) return false;
      return true;
    });

    jobs = sortJobs(jobs, sort);

    sources.push({
      source: name,
      count: jobs.length,
      items: jobs.slice(0, 25).map((j) => ({
        title: j.title,
        company: j.company,
        location: j.location,
        url: j.url,
        postedAt: j.postedAt,
        salary: j.salaryMax || null,
      })),
    });
    total += jobs.length;
  }

  res.status(200).json({ query: q, total, sources });
}

function sortJobs(jobs, sort) {
  const copy = [...jobs];
  if (sort === "newest") {
    copy.sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));
  } else if (sort === "salary") {
    copy.sort((a, b) => (b.salaryMax || 0) - (a.salaryMax || 0));
  }
  return copy;
}

async function fetchRemoteOK() {
  const r = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "jobly-app" },
  });
  const data = await r.json();
  // First element is a legal/notice object, not a job — skip it.
  const jobs = Array.isArray(data) ? data.slice(1) : [];
  return jobs.map((j) => ({
    title: j.position,
    company: j.company,
    location: j.location || "Remote",
    url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
    tags: j.tags || [],
    remote: true,
    postedAt: j.date ? new Date(j.date).getTime() : 0,
    salaryMax: j.salary_max || null,
  }));
}

async function fetchArbeitnow() {
  const r = await fetch("https://www.arbeitnow.com/api/job-board-api");
  const data = await r.json();
  const jobs = Array.isArray(data.data) ? data.data : [];
  return jobs.map((j) => ({
    title: j.title,
    company: j.company_name,
    location: j.location || (j.remote ? "Remote" : ""),
    url: j.url,
    tags: j.tags || [],
    remote: !!j.remote,
    postedAt: j.created_at ? j.created_at * 1000 : 0,
    salaryMax: null, // Arbeitnow doesn't expose structured salary data
  }));
}
