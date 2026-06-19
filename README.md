# Interview Visualizer

A personal collection of standalone, interactive HTML visualizations for learning
system-design and CS interview concepts. Each visualization is a **single self-contained
`.html` file**. The homepage builds itself: it lists every visualization in a clean table
(**Name + Date Created**) split across **Active** and **Archived** tabs. The whole thing is
a static site hosted free on **GitHub Pages**, and individual pages embed into **Notion**
via their URLs.

** Fast workflow:** ask an AI to generate a visualization → open https://github.com/faang-cush/itv-visualizer/upload/main/modules and drag the resulting `.html` -> commit -> done

** Normal workflow:** ask an AI to generate a visualization → open code drop the resulting `.html` file
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

**Easiest — from the homepage:** open the live site **directly** (not the Notion embed), hover
a row, and click the **Archive** / **Activate** link. It opens that file in GitHub's web editor,
jumped to the `<meta name="status">` line, with a tooltip telling you exactly what to change.
Flip `content="active"` ⇄ `content="archived"` and click **Commit changes** — the site rebuilds
in ~30s. (These controls are hidden inside the Notion embed, so the embed stays a clean
Name + Date table.)

**Or by hand:** open the module and change

```html
<meta name="status" content="active">
```

to

```html
<meta name="status" content="archived">
```

then push. Either way, the module moves from the **Active** tab to the **Archived** tab on the
next deploy. The module's URL does **not** change, so any existing Notion embed keeps working.
Reversible at any time — flip it back to `active`.

---

## One-time setup (scripted)

Everything on the GitHub side is automated by `scripts/setup.sh` via the GitHub CLI — no
clicking through the UI.

**Prereqs (once):** install the [GitHub CLI](https://cli.github.com), then `gh auth login`.

**Run it:**
```bash
DOMAIN=https://learning.visualizeconcepts.tech ./scripts/setup.sh
# or: DOMAIN=viz.yourname.tech REPO=itv-visualizer ./scripts/setup.sh
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
I am learning for backend dev 4YOE interview. Build a visualization for:
- [Concept] — focus on [the one thing that's hardest to remember] & all things you need it

One self-contained .html file, all inline. CDN libs OK.
<title> = human-readable name. <meta name="status" content="active">.
No localStorage/sessionStorage. State in memory only (Notion iframe sandbox).
Laptop only, no responsive needed.
Keyboard-accessible, respects prefers-reduced-motion.
```
