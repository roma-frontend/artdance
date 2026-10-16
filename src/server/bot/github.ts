import 'server-only';

import { getServerEnv } from '@/config/env';

const GH_API = 'https://api.github.com';

function ghHeaders(): Record<string, string> {
  const token = getServerEnv().GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN missing');
  return { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' };
}

export async function ghListRuns(owner: string, repo: string, limit = 5): Promise<string> {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/actions/runs?per_page=${limit}`, { headers: ghHeaders(), cache: 'no-store' });
  const t = await res.text();
  if (!res.ok) throw new Error(`github runs ${res.status}: ${t.slice(0, 600)}`);
  const j = JSON.parse(t) as { workflow_runs: Array<{ name: string; status: string; conclusion: string | null; head_branch: string; run_number: number; html_url: string; created_at: string }> };
  if (!j.workflow_runs.length) return 'no runs';
  return j.workflow_runs.map((r) => `#${r.run_number} ${r.name} ${r.head_branch} ${r.status}/${r.conclusion ?? '—'} ${r.created_at} ${r.html_url}`).join('\n');
}

export async function ghRepoInfo(owner: string, repo: string): Promise<string> {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}`, { headers: ghHeaders(), cache: 'no-store' });
  const t = await res.text();
  if (!res.ok) throw new Error(`github repo ${res.status}: ${t.slice(0, 600)}`);
  const j = JSON.parse(t) as { full_name: string; default_branch: string; private: boolean; updated_at: string };
  return `${j.full_name} default=${j.default_branch} private=${j.private} updated=${j.updated_at}`;
}
