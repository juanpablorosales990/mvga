#!/usr/bin/env node
/**
 * Trigger a production deployment on Vercel using the REST API (Git-based).
 *
 * Why: In Hobby/free tier, `vercel deploy` uploads can hit hard file/request limits.
 * This script triggers a deployment from Git instead (no local upload), which is also
 * useful when webhooks are delayed.
 *
 * Usage:
 *   node scripts/vercel_trigger_prod_deploy.mjs wallet
 *   node scripts/vercel_trigger_prod_deploy.mjs web
 *   node scripts/vercel_trigger_prod_deploy.mjs all
 *
 * Notes:
 * - Reads token from `VERCEL_TOKEN` or the Vercel CLI auth file on macOS.
 * - This repo is connected to GitHub repoId 1150058255 (juanpablorosales990/mvga).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const GITHUB_REPO_ID = 1150058255;
const GIT_REF = 'main';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function findVercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;

  const home = process.env.HOME;
  const candidates = [
    // macOS default for Vercel CLI
    home && path.join(home, 'Library', 'Application Support', 'com.vercel.cli', 'auth.json'),
    // other common locations
    home && path.join(home, '.vercel', 'auth.json'),
    home && path.join(home, '.config', 'vercel', 'auth.json'),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      const j = readJson(p);
      if (j?.token) return j.token;
    } catch {
      // ignore
    }
  }
  return null;
}

function gitHeadSha() {
  return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}

async function triggerDeployment({ projectName, teamId, sha, token }) {
  const url = `https://api.vercel.com/v13/deployments?teamId=${encodeURIComponent(teamId)}`;
  const payload = {
    name: projectName,
    project: projectName,
    target: 'production',
    gitSource: {
      type: 'github',
      repoId: GITHUB_REPO_ID,
      ref: GIT_REF,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error?.message || text || `HTTP ${res.status}`;
    const reset = json?.error?.limit?.reset ? new Date(json.error.limit.reset).toISOString() : null;
    const hint = reset ? ` (reset ${reset})` : '';
    throw new Error(`Vercel deploy trigger failed for ${projectName}: ${msg}${hint}`);
  }

  return json;
}

const target = (process.argv[2] || 'all').toLowerCase();
const allowed = new Set(['wallet', 'web', 'all']);
if (!allowed.has(target)) {
  console.error('Usage: node scripts/vercel_trigger_prod_deploy.mjs [wallet|web|all]');
  process.exit(2);
}

const token = findVercelToken();
if (!token) {
  console.error('Missing Vercel token. Set VERCEL_TOKEN or login with `vercel login`.');
  process.exit(1);
}

const sha = gitHeadSha();
const root = process.cwd();

const projects = [];
if (target === 'wallet' || target === 'all') {
  const walletCfg = readJson(path.join(root, '.vercel', 'project.json'));
  projects.push({ projectName: walletCfg.projectName, teamId: walletCfg.orgId });
}
if (target === 'web' || target === 'all') {
  const webCfg = readJson(path.join(root, 'apps', 'web', '.vercel', 'project.json'));
  projects.push({ projectName: webCfg.projectName, teamId: webCfg.orgId });
}

for (const p of projects) {
  // eslint-disable-next-line no-console
  console.log(`Triggering ${p.projectName} @ ${sha.slice(0, 7)}...`);
  const out = await triggerDeployment({ ...p, sha, token });
  // eslint-disable-next-line no-console
  console.log(`OK: https://${out?.url || '(no url returned)'}`);
}
