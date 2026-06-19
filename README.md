# Interview Visualizer

A personal collection of standalone, interactive HTML visualizations for learning
system-design and CS interview concepts. Each visualization is a **single self-contained
`.html` file**. The homepage builds itself: it lists every visualization in a clean table
(**Name + Date Created**) split across **Active** and **Archived** tabs. The whole thing is
a static site hosted free on **GitHub Pages**, and individual pages embed into **Notion**
via their URLs.

**The workflow:** ask an AI to generate a visualization → drop the resulting `.html` file
into `modules/` → `git push`. A GitHub Action regenerates the homepage and redeploys. You
never hand-edit the homepage — `index.html` is generated on every push and is not committed.

---

## Folder structure

```
/
├── modules/                  # every visualization .html file lives here
│   └── example-stepper.html  # a sample module demonstrating the conventions
├── scripts/
│   ├── generate.js           # the homepage generator (Node, no dependencies)
│   └── setup.sh              # one-shot GitHub provisioning via the gh CLI
├── CNAME                     # custom domain (created by setup.sh; shipped on every deploy)
├── .github/
│   └── workflows/
│       └── deploy.yml         # GitHub Action: build + deploy to Pages
├── .gitignore
└── README.md
```

`index.html` is **not** committed — the build produces `_site/index.html` fresh on every deploy.

---

## Module conventions

Every `.html` file in `modules/` must:

1. **Be a single, self-contained file.** All CSS and JS inline. External resources (D3,
   Cytoscape, Three.js, ECharts, …) via **CDN only**. No file may depend on another file in
   the repo.
2. **Have a `<title>` in the `<head>`.** This text is the name shown in the homepage table.
3. **Have a status meta tag** in the `<head>`, in exactly this form:
   ```html
   <meta name="status" content="active">
   ```
   Valid values: `active` or `archived`. This tag is the **single source of truth** for which
   tab the module appears on. (Missing or unrecognized → treated as `active`, with a warning
   in the build log, so a non-compliant file never silently disappears.)
4. **Use no browser storage.** No `localStorage`, `sessionStorage`, or any storage API —
   Notion embeds run in a sandboxed iframe that blocks storage. Keep all state in memory
   (JS variables only).
5. **Be responsive.** Look good both full-page and at a constrained embed height of roughly
   **400–600px** (the typical Notion embed height).

The **Name** column links to the module (`modules/<filename>.html`) and the **Date Created**
column is the date the file was first committed to Git. Rows are sorted newest-first.

---

## Archiving a module

To archive a module, open it and change:

```html
<meta name="status" content="active">
```

to:

```html
<meta name="status" content="archived">
```

Then push. On the next deploy it moves from the **Active** tab to the **Archived** tab. The
module's URL does **not** change, so any existing Notion embed keeps working. Reversible at
any time — flip it back to `active`.

---

## One-time setup (scripted)

Everything on the GitHub side is automated by `scripts/setup.sh` via the GitHub CLI — no
clicking through the UI.

**Prereqs (once):** install the [GitHub CLI](https://cli.github.com), then `gh auth login`.

**Run it:**
```bash
DOMAIN=www.yourname.tech ./scripts/setup.sh
# or: DOMAIN=viz.yourname.tech REPO=interview-visualizer ./scripts/setup.sh
```

The script is idempotent (safe to re-run) and:
- writes the root `CNAME` file (the generator ships it into every deploy),
- creates the **public** repo if missing and pushes `main`,
- sets Pages **Source = GitHub Actions**,
- sets the **custom domain**, and
- enables **Enforce HTTPS** (best-effort — the TLS cert can take up to ~24h the first time; if
  it isn't ready, the script prints the one-liner to enable it later).

**DNS — the one manual step** (get.tech has no API): in the get.tech DNS panel add a single
record:

| Type | Host / Name | Value / Points to | TTL |
|---|---|---|---|
| `CNAME` | `www` *(or your chosen subdomain)* | `<your-username>.github.io` | default |

After the Action runs (see the repo's **Actions** tab) and DNS propagates, the site is live at
`https://www.yourname.tech`. Until DNS resolves it's reachable at the temporary
`https://<username>.github.io/<repo>/`.

**Embed in Notion:** type `/embed`, paste a page URL (the homepage, or any individual module),
and adjust the embed height.

On a public repository, GitHub Actions and GitHub Pages are both free for this use, and the
generator runs in seconds per push.

---

## Building locally

No dependencies, no `npm install`:

```bash
node scripts/generate.js
```

This writes the publishable site to `_site/` (a copy of `modules/` plus the generated
`index.html`). Open `_site/index.html` to preview. Date Created is read from Git history, so
dates resolve correctly once files are committed (before that, the generator falls back to the
file's modification time and prints a warning).

---

## Prompt preamble for generating new modules

Paste this before any module-generation request to an AI, then describe the concept:

```
Output exactly ONE self-contained .html file — all HTML, CSS, and JavaScript inline in that single file. No separate files. Any libraries must be loaded from a CDN.

Requirements:
- Include a <title> in the head: this is the human-readable name of the visualization.
- Include this exact tag in the head: <meta name="status" content="active">
- The page must work by simply opening the file — no build step, no server.
- Do NOT use localStorage, sessionStorage, or any browser storage API. Keep all state in memory only. (It will be embedded in a sandboxed Notion iframe that blocks storage.)
- Make it responsive and ensure it looks good both full-page and at a constrained height of about 400–600px.
- Keyboard-accessible and respects prefers-reduced-motion.

Then build the visualization described below:
[describe the concept to visualize here]
```
