# Deploying and using Orbital Atlas

The ZIP contains a ready-built, standalone website. The root `index.html` contains all runtime code, styles, mathematics, and fonts. GitHub Pages needs no npm packages, build action, API keys, backend, or external compute service.

These instructions use a repository named `orbital-atlas` and a publishing branch named `main`. Replace `YOUR-USERNAME` with your GitHub username. The website can also run offline directly from the extracted HTML file; see the offline section below.

## First publish with Git

This route needs Git and a GitHub account. If Git is not installed, use the [official Git downloads](https://git-scm.com/downloads), or choose the browser-upload alternative below.

1. On GitHub, create a new **empty** repository named `orbital-atlas`. A public repository works with GitHub Free. Leave the options to add a README, license, or `.gitignore` unchecked; this export already includes its own files.
2. Extract the ZIP into a new folder. Open a terminal in that folder. `index.html`, `README.md`, `.nojekyll`, `src`, and `scripts` should be directly inside it, not nested inside another export folder.
3. Run:

```sh
git init -b main
git add .
git commit -m "Publish Orbital Atlas"
git remote add origin https://github.com/YOUR-USERNAME/orbital-atlas.git
git push -u origin main
```

Use your normal GitHub sign-in through Git Credential Manager or GitHub CLI when authentication is requested. The browser sign-in can use your account's configured passkey or other authentication method. Do not put a password or token into the commands or repository files. If Git asks for your commit author name and email, configure your usual Git identity and retry the commit.

4. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then **main** and **/(root)**. Click **Save**.
5. Wait for the deployment to finish. The Pages settings page supplies the live URL, normally `https://YOUR-USERNAME.github.io/orbital-atlas/`.
6. Replace the hosted-preview link in `README.md` with your published URL and commit that change.

The repository root must contain `index.html`; uploading the ZIP itself does not deploy the site. Keep `.nojekyll` so the files are published as static assets. GitHub Pages is publicly accessible; this export contains no account credentials or private hosting configuration.

## Update an existing GitHub repository

Keep the existing Git history. Clone your repository into a new working folder if you do not already have a checkout:

```sh
git clone https://github.com/YOUR-USERNAME/orbital-atlas.git
cd orbital-atlas
```

If you already have a checkout, open its folder instead. Before copying the new export, check for local changes:

```sh
git status --short
```

Continue only when that command shows no changes. Save or commit any existing work first. Then update the publishing branch:

```sh
git switch main
git pull --ff-only
```

If the fast-forward pull fails, resolve the branch difference before applying the export; do not force-push or delete the repository's history.

Extract the updated ZIP into a separate temporary folder. Copy its **contents** into the repository folder, replacing the website files. Keep the repository's `.git` directory and any custom `CNAME` file. Preserve any customizations you want to carry forward, including your own website link in `README.md`.

Review and publish the update:

```sh
git diff --stat
git add .
git diff --cached --stat
git commit -m "Update Orbital Atlas"
git push origin main
```

GitHub Pages deploys the new commit using the existing **main → /(root)** setting. No repeated Pages setup or credentials in the website are needed.

## Browser upload alternative

1. Extract the ZIP, then create a GitHub repository or open your existing one.
2. Use **Add file → Upload files** to upload the extracted contents, including the `src` and `scripts` folders. Put `index.html` directly at the repository root and commit the upload to `main`.
3. Include `.nojekyll`. If your file browser hides it, use **Add file → Create new file**, name it `.nojekyll`, and commit it.
4. For the first deployment, select **Settings → Pages → Deploy from a branch → main → /(root) → Save**. Later uploads to that branch trigger updates automatically.
5. Use the live URL from Pages settings in your repository's README.

## Official references

- [Add local code to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
- [GitHub authentication with a credential manager](https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git)
- [Configure the GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Git pull and fast-forward updates](https://git-scm.com/docs/git-pull)
- [Troubleshoot a missing index.html](https://docs.github.com/en/pages/getting-started-with-github-pages/troubleshooting-404-errors-for-github-pages-sites)

## First-use offline operation

Extract the ZIP, then open its root `index.html` directly in your browser. An internet connection, local web server, service worker, and previously cached copy are unnecessary. The mathematics and fonts are inside the HTML alongside the application code.

The browser must support WebGL 2 and allow local HTML to use graphics acceleration. If a device's file viewer shows only a preview, open the file with a full browser or host it through GitHub Pages. A hosted URL naturally needs a connection to download the page; use the downloaded HTML file for offline operation.

Reference links in the mathematics and README require a connection when you choose to open them, but they are not runtime dependencies.

## Editing and rebuilding

Edit the files in `src/`, then run this from the repository root with Python 3.10 or later:

```sh
python3 scripts/build-standalone.py
```

On Windows with the Python launcher:

```sh
py scripts/build-standalone.py
```

This rewrites root `index.html`, embedding the styles, local fonts, math guide, math fragments, and renderer. The builder needs only Python's standard library and does not download anything. Commit the regenerated `index.html` with your source changes; GitHub Pages will publish it on the next deployment.

The supplied mathematics is already typeset. To change formulas, edit `src/math-guide.tex.html` or `src/math-fragments.tex.json`, then run the optional math compiler with Node.js before the Python builder:

```sh
node scripts/render-math.cjs
python3 scripts/build-standalone.py
```

The math compiler is bundled in `scripts/vendor/`; it requires no npm install, CDN, or network access. Node.js is needed only when regenerating formulas, not for using or publishing the website. The Python builder embeds the resulting pre-rendered `src/assets/math-guide.html` and `math-fragments.json`.

Do not edit the generated HTML as your long-term source of truth: a rebuild replaces it. Do not upload only the source template, which intentionally contains build markers. Font license notices should remain in the repository when redistributing the included typography.

## Troubleshooting

- **404:** check Pages is set to `main` and `/(root)`, with `index.html` at that location.
- **Old page:** reload the hosted page after the deployment finishes. All application code is bundled into that one HTML response.
- **No 3D view:** enable browser graphics acceleration and use a WebGL 2 browser. The math guide and atlas remain available if WebGL initialization fails.
- **Still particles:** select Play, enable probability-current tracers, select the Complex basis, and choose a nonzero m. Real stationary states and m = 0 correctly have zero current.
- **Low frame rate:** choose Adaptive or Efficient, reduce the tracer amount, or pause the animation while inspecting the shape.
- **Math missing after editing:** rebuild from the complete source tree and preserve all math assets.

For rendering details and the meaning of the visual effects, see `RENDERING-NOTES.md`.
