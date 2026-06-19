#!/usr/bin/env node
'use strict';

/*
 * Homepage generator for the Interview Visualizer site.
 *
 * - Reads every *.html file in modules/
 * - Extracts <title> (the display name) and <meta name="status"> (active|archived)
 * - Reads the file's first-commit date from Git
 * - Builds _site/ : copies modules/ in, writes a generated index.html
 *
 * Dependency-free: uses only built-in fs / path / child_process.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MODULES_DIR = path.join(ROOT, 'modules');
const SITE_DIR = path.join(ROOT, '_site');

const warnings = [];
function warn(msg) {
  warnings.push(msg);
  console.warn('  ! ' + msg);
}

// ---------------------------------------------------------------------------
// Extraction helpers (simple, robust regex — no HTML-parsing dependency)
// ---------------------------------------------------------------------------

function extractTitle(html, fallback) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (m && m[1].trim()) {
    return decodeEntities(m[1].trim().replace(/\s+/g, ' '));
  }
  warn(`No <title> in "${fallback}.html" — falling back to filename.`);
  return fallback;
}

function extractStatus(html, fileLabel) {
  // Match <meta name="status" content="..."> with attributes in any order.
  const tag = html.match(/<meta\b[^>]*\bname\s*=\s*["']status["'][^>]*>/i);
  if (tag) {
    const c = tag[0].match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (c) {
      const val = c[1].trim().toLowerCase();
      if (val === 'active' || val === 'archived') return val;
      warn(`Unrecognized status "${c[1]}" in "${fileLabel}" — defaulting to active.`);
      return 'active';
    }
  }
  warn(`Missing status meta tag in "${fileLabel}" — defaulting to active.`);
  return 'active';
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Git creation date
// ---------------------------------------------------------------------------

function gitCreationDate(filePath) {
  // git log lists newest-first; the original "added" commit is the LAST line.
  try {
    const out = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', filePath],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length) return lines[lines.length - 1];
  } catch (e) {
    // git not available, not a repo, or file not committed yet — fall through.
  }
  return null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(iso) {
  // Read the calendar date straight from the ISO string's own components so we
  // preserve the author-local date (git's %aI carries the author's offset). A
  // timezone conversion here would drift the day for commits made near midnight.
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${parseInt(m[3], 10)} ${MONTHS[parseInt(m[2], 10) - 1]} ${m[1]}`;
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ---------------------------------------------------------------------------
// Collect modules
// ---------------------------------------------------------------------------

function collectModules() {
  if (!fs.existsSync(MODULES_DIR)) {
    warn('modules/ directory does not exist — producing an empty homepage.');
    return [];
  }
  const files = fs
    .readdirSync(MODULES_DIR)
    .filter((f) => f.toLowerCase().endsWith('.html'));

  const entries = [];
  for (const file of files) {
    const full = path.join(MODULES_DIR, file);
    const base = file.replace(/\.html$/i, '');
    const html = fs.readFileSync(full, 'utf8');

    const name = extractTitle(html, base);
    const status = extractStatus(html, file);

    const isoDate = gitCreationDate(path.join('modules', file));
    let displayDate, sortKey;
    if (isoDate) {
      displayDate = formatDate(isoDate);
      sortKey = new Date(isoDate).getTime();
    } else {
      // Not committed yet (e.g. local run before first commit). Fall back to
      // the filesystem modification time so the entry still appears.
      const mtime = fs.statSync(full).mtime;
      displayDate = formatDate(mtime.toISOString());
      sortKey = mtime.getTime();
      warn(`No Git creation date for "${file}" — using file mtime.`);
    }

    entries.push({
      name,
      status,
      href: `modules/${file}`,
      displayDate,
      sortKey,
    });
  }

  // Sort reverse-chronological (newest first); stable tie-break by name.
  entries.sort((a, b) => b.sortKey - a.sortKey || a.name.localeCompare(b.name));
  return entries;
}

// ---------------------------------------------------------------------------
// Render homepage
// ---------------------------------------------------------------------------

function renderRows(entries) {
  if (!entries.length) {
    return `<tr class="empty"><td colspan="2">Nothing here yet.</td></tr>`;
  }
  return entries
    .map(
      (e) => `<tr>
            <td class="name"><a href="${escapeHtml(e.href)}">${escapeHtml(e.name)}</a></td>
            <td class="date">${escapeHtml(e.displayDate)}</td>
          </tr>`
    )
    .join('\n          ');
}

function renderHomepage(active, archived) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Interview Visualizer</title>
  <meta name="description" content="A collection of interactive visualizations for system-design and CS interview concepts." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0e1116;
      --surface: #151a21;
      --surface-2: #1b212a;
      --line: #232b35;
      --text: #e6e9ef;
      --text-dim: #9aa4b2;
      --text-faint: #6b7585;
      --accent: #7aa2ff;
      --accent-soft: rgba(122, 162, 255, 0.12);
      --radius: 14px;
      --font-display: "Space Grotesk", system-ui, sans-serif;
      --font-body: "Inter", system-ui, -apple-system, sans-serif;
      --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    body {
      display: flex;
      justify-content: center;
      padding: clamp(16px, 4vw, 48px) clamp(12px, 4vw, 40px);
      min-height: 100vh;
    }

    .wrap {
      width: 100%;
      max-width: 760px;
    }

    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
      flex-wrap: wrap;
    }

    h1 {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: clamp(1.25rem, 1rem + 1.4vw, 1.6rem);
      letter-spacing: -0.01em;
      margin: 0;
    }

    .count {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--text-faint);
    }

    /* Tabs */
    .tabs {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 999px;
      margin-bottom: 18px;
    }

    .tab {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--text-dim);
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 0.82rem;
      padding: 7px 18px;
      border-radius: 999px;
      cursor: pointer;
      transition: background 0.18s ease, color 0.18s ease;
    }

    .tab:hover { color: var(--text); }

    .tab[aria-selected="true"] {
      background: var(--accent-soft);
      color: var(--accent);
    }

    .tab:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    /* Table card */
    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead th {
      text-align: left;
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-faint);
      padding: 14px 22px;
      border-bottom: 1px solid var(--line);
    }

    thead th.date-col { text-align: right; }

    tbody td {
      padding: 15px 22px;
      border-bottom: 1px solid var(--line);
      vertical-align: middle;
    }

    tbody tr:last-child td { border-bottom: 0; }

    tbody tr { transition: background 0.14s ease; }
    tbody tr:hover { background: var(--surface-2); }

    td.name a {
      color: var(--text);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.95rem;
      display: inline-block;
    }

    td.name a:hover { color: var(--accent); }

    td.name a:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
      border-radius: 3px;
    }

    td.date {
      text-align: right;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--text-dim);
      white-space: nowrap;
    }

    tr.empty td {
      text-align: center;
      color: var(--text-faint);
      padding: 40px 22px;
      font-style: italic;
    }

    [hidden] { display: none !important; }

    footer {
      margin-top: 18px;
      font-size: 0.72rem;
      color: var(--text-faint);
      text-align: center;
    }

    @media (max-width: 480px) {
      thead th, tbody td { padding-left: 16px; padding-right: 16px; }
      td.name a { font-size: 0.9rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      * { transition: none !important; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <header>
      <h1>Interview Visualizer</h1>
      <span class="count" id="count"></span>
    </header>

    <div class="tabs" role="tablist" aria-label="Module status">
      <button class="tab" role="tab" id="tab-active" aria-controls="panel-active" aria-selected="true">Active</button>
      <button class="tab" role="tab" id="tab-archived" aria-controls="panel-archived" aria-selected="false" tabindex="-1">Archived</button>
    </div>

    <div class="card">
      <div role="tabpanel" id="panel-active" aria-labelledby="tab-active">
        <table>
          <thead>
            <tr><th scope="col">Name</th><th scope="col" class="date-col">Date Created</th></tr>
          </thead>
          <tbody>
          ${renderRows(active)}
          </tbody>
        </table>
      </div>

      <div role="tabpanel" id="panel-archived" aria-labelledby="tab-archived" hidden>
        <table>
          <thead>
            <tr><th scope="col">Name</th><th scope="col" class="date-col">Date Created</th></tr>
          </thead>
          <tbody>
          ${renderRows(archived)}
          </tbody>
        </table>
      </div>
    </div>

    <footer>Push an .html file to <code>modules/</code> — this page rebuilds itself.</footer>
  </main>

  <script>
    (function () {
      var counts = { active: ${active.length}, archived: ${archived.length} };
      var tabs = {
        active: document.getElementById('tab-active'),
        archived: document.getElementById('tab-archived')
      };
      var panels = {
        active: document.getElementById('panel-active'),
        archived: document.getElementById('panel-archived')
      };
      var countEl = document.getElementById('count');

      function select(name) {
        Object.keys(tabs).forEach(function (key) {
          var on = key === name;
          tabs[key].setAttribute('aria-selected', on ? 'true' : 'false');
          tabs[key].tabIndex = on ? 0 : -1;
          panels[key].hidden = !on;
        });
        var n = counts[name];
        countEl.textContent = n + (n === 1 ? ' module' : ' modules');
      }

      Object.keys(tabs).forEach(function (name) {
        tabs[name].addEventListener('click', function () { select(name); });
      });

      // Arrow-key navigation between tabs.
      var order = ['active', 'archived'];
      document.querySelector('[role="tablist"]').addEventListener('keydown', function (e) {
        var current = order.indexOf(
          tabs.active.getAttribute('aria-selected') === 'true' ? 'active' : 'archived'
        );
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % order.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current + order.length - 1) % order.length;
        if (next !== null) {
          e.preventDefault();
          select(order[next]);
          tabs[order[next]].focus();
        }
      });

      select('active');
    })();
  </script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Build _site/
// ---------------------------------------------------------------------------

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function build() {
  console.log('Generating Interview Visualizer site...');

  const entries = collectModules();
  const active = entries.filter((e) => e.status === 'active');
  const archived = entries.filter((e) => e.status === 'archived');

  // Fresh _site/
  fs.rmSync(SITE_DIR, { recursive: true, force: true });
  fs.mkdirSync(SITE_DIR, { recursive: true });

  // Copy modules/ across so the relative links resolve on the live site.
  if (fs.existsSync(MODULES_DIR)) {
    copyDir(MODULES_DIR, path.join(SITE_DIR, 'modules'));
  }

  fs.writeFileSync(path.join(SITE_DIR, 'index.html'), renderHomepage(active, archived), 'utf8');

  // If a custom domain is configured (a CNAME file at the repo root), ship it
  // inside the artifact so GitHub Pages keeps serving the domain on every deploy.
  const cnamePath = path.join(ROOT, 'CNAME');
  let customDomain = null;
  if (fs.existsSync(cnamePath)) {
    customDomain = fs.readFileSync(cnamePath, 'utf8').trim();
    fs.writeFileSync(path.join(SITE_DIR, 'CNAME'), customDomain + '\n', 'utf8');
  }

  console.log('');
  console.log(`  active:   ${active.length}`);
  console.log(`  archived: ${archived.length}`);
  console.log(`  total:    ${entries.length}`);
  console.log(`  warnings: ${warnings.length}`);
  if (customDomain) console.log(`  domain:   ${customDomain} (CNAME shipped)`);
  console.log('');
  console.log('Done. Output written to _site/');
}

build();
