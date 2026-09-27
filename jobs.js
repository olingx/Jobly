// Shared logic used by /api/search.js and /api/check-alerts.js

export const NONPROFIT_KEYWORDS = ["nonprofit", "non-profit", "ngo", "charity", "foundation"];

export async function fetchRemoteOK() {
  const r = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "jobly-app" },
  });
  const data = await r.json();
  const jobs = Array.isArray(data) ? data.slice(1) : []; // first item is a legal notice, not a job
  return jobs.map((j) => ({
    title: j.position,
    company: j.company,
    location: j.location || "Remote",
    url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
    tags: j.tags || [],
    remote: true,
    postedAt: j.date ? new Date(j.date).getTime() : 0,
    salaryMax: j.salary_max || null,
    source: "RemoteOK",
  }));
}

export async function fetchArbeitnow() {
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
    source: "Arbeitnow",
  }));
}

export async function fetchAllJobs() {
  const [a, b] = await Promise.allSettled([fetchRemoteOK(), fetchArbeitnow()]);
  const jobs = [];
  const errors = [];
  if (a.status === "fulfilled") jobs.push(...a.value); else errors.push("RemoteOK");
  if (b.status === "fulfilled") jobs.push(...b.value); else errors.push("Arbeitnow");
  return { jobs, errors };
}

export function filterJobs(jobs, { terms = [], remoteOnly, locationFilter, nonprofitOnly }) {
  return jobs.filter((j) => {
    const haystack = `${j.title} ${j.company} ${(j.tags || []).join(" ")}`.toLowerCase();
    if (terms.length && !terms.some((t) => haystack.includes(t))) return false;
    if (remoteOnly && !j.remote) return false;
    if (locationFilter && !(j.location || "").toLowerCase().includes(locationFilter)) return false;
    if (nonprofitOnly && !NONPROFIT_KEYWORDS.some((k) => haystack.includes(k))) return false;
    return true;
  });
}

export function sortJobs(jobs, sort) {
  const copy = [...jobs];
  if (sort === "newest") copy.sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));
  else if (sort === "salary") copy.sort((a, b) => (b.salaryMax || 0) - (a.salaryMax || 0));
  return copy;
}
