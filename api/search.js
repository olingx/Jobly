// Vercel serverless function: /api/search?q=...&remote=true&location=...&nonprofit=true&sort=newest|salary|relevance
import { fetchAllJobs, filterJobs, sortJobs } from "../lib/jobs.js";

const SOURCE_NAMES = ["RemoteOK", "Arbeitnow"];

export default async function handler(req, res) {
  const q = (req.query.q || "").trim();
  if (!q) {
    res.status(400).json({ error: "Missing query param 'q'" });
    return;
  }

  // Cache identical searches at Vercel's edge for 30 min — cuts repeat calls
  // to the underlying free APIs so you don't burn their rate limits.
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");

  const terms = q.toLowerCase().split(/\s+/);
  const remoteOnly = req.query.remote === "true";
  const locationFilter = (req.query.location || "").trim().toLowerCase();
  const nonprofitOnly = req.query.nonprofit === "true";
  const sort = req.query.sort || "relevance";

  const { jobs, errors } = await fetchAllJobs();
  const filtered = sortJobs(
    filterJobs(jobs, { terms, remoteOnly, locationFilter, nonprofitOnly }),
    sort
  );

  const bySource = {};
  for (const j of filtered) {
    bySource[j.source] = bySource[j.source] || [];
    bySource[j.source].push(j);
  }

  const sources = SOURCE_NAMES.map((name) => {
    if (errors.includes(name)) return { source: name, count: 0, items: [], error: true };
    const list = bySource[name] || [];
    return {
      source: name,
      count: list.length,
      items: list.slice(0, 25).map((j) => ({
        title: j.title,
        company: j.company,
        location: j.location,
        url: j.url,
        postedAt: j.postedAt,
        salary: j.salaryMax,
      })),
    };
  });

  const total = sources.reduce((sum, s) => sum + s.count, 0);
  res.status(200).json({ query: q, total, sources });
}
