# Lab Ledger

Mobile-first static web app for logging lab progress. Data is local-first (IndexedDB) and syncs to a Google Sheet per course, directly from the browser. There is no server.

- Log work by keypad, chips or compact notation (`12,14-16 3.{5-8}`, `12 -3.5`, `3.*`).
- Append-only `Log` tab is the source of truth. `Assignment N`, `Datewise` and `Summary` tabs are rebuilt from it.
- Heatmaps, print view, query language (`missing 3.{5-8} r:1-30`, `lag>3`, `by:ta@x since:-7d`, `sort:progress`).
- Works offline (PWA). Several instructors/TAs can edit the same Sheet.

## Run locally (no Google needed)

```
npm install
npm run dev        # http://localhost:5173/lab-ledger/
npm test
npm run build && npm run preview
```

Without the `VITE_GOOGLE_*` variables the app runs in demo/local mode: use "Try demo course" or create a local course. Local courses live only in this browser.

## Notation

| Input | Meaning |
|---|---|
| `3.5` | assignment 3, problem 5 |
| `3.{2,10-12},4.{1-5}` | sets and ranges |
| `3.*` | whole assignment 3 |
| `-3.5` | undo (prefix `-`) |
| `12,14-16 3.5` | several rolls, then work |
| several lines | one roll list + work per line (paste preview shown) |

## Query language

`missing [work]`, `remaining`, `done [work]`, `lag>N` (behind the class median), filters `r:1-30`, `a:3`, `on:YYYY-MM-DD`, `since:-7d`, `until:`, `by:email`, and `sort:progress` (least progress first) / `sort:-progress` / `sort:lag` / `sort:count`.

## Google setup (step by step)

The app uses the browser-only OAuth token flow with the scopes `drive.file openid email`. With `drive.file`, the app can only touch spreadsheets it created or that the user opened through the Google Picker, so no "unverified app" review is required.

1. Go to https://console.cloud.google.com and create a project (e.g. "Lab Ledger").
2. APIs & Services > Library: enable **Google Sheets API**, **Google Drive API** and **Google Picker API**.
3. APIs & Services > OAuth consent screen: choose External, fill in app name and your email. Add scopes `openid`, `email`, `.../auth/drive.file`. While in "Testing" status, add every instructor/TA Google account under Test users (or publish the app; `drive.file` needs no verification).
4. APIs & Services > Credentials > Create credentials > **OAuth client ID**, type **Web application**. Authorized JavaScript origins:
   - `http://localhost:5173`
   - `https://<your-github-user>.github.io`

   (Origins have no path. No redirect URIs are needed.) Copy the Client ID.
5. Create credentials > **API key**. Restrict it: Application restrictions = Websites with referrers `http://localhost:5173/*`, `https://<your-github-user>.github.io/*` and `https://docs.google.com/*`; API restrictions = **Google Picker API** only. Copy the key.

   The `docs.google.com` entry is required for Firefox (and other browsers that partition third-party cookies). There the Picker first asks to "Allow cookies", then reloads its own iframe. That reload sends `docs.google.com` as the referrer, so without the entry the Picker fails with "The API developer key is invalid".
6. The **App ID** is the numeric project number (Cloud console > Dashboard > Project number).
7. Locally, put the three values in `.env.local` (see `.env.example`):
   ```
   VITE_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   VITE_GOOGLE_API_KEY=...
   VITE_GOOGLE_APP_ID=...
   ```
8. On GitHub: Settings > Secrets and variables > Actions > **Variables**, add the same three as repository variables (they are public values, shipped in the bundle).

## Deploy to GitHub Pages

1. Create the repo, push `main`. The base path in `vite.config.ts` is `/lab-ledger/`; change it if the repo has another name.
2. Settings > Pages > Source: **GitHub Actions**.
3. `.github/workflows/pages.yml` runs tests, builds, and deploys on every push to `main`.

## Sheet schema

Per course spreadsheet: `Log` (id, ts, date, roll, problem, action, ref, by, batch, device), `Rolls` (roll, active), `Assignments` (id, title, problems, problem_titles, active), `Meta`. `Assignment N`, `Datewise` and `Summary` are derived and overwritten wholesale about 60 s after a successful push (or with "Rebuild sheet views"). Do not hand-edit them or `Log`.

## Sharing a course

Manage > Invite a TA shares the Sheet as editor. They open the course link (`#/c/<id>`) and pick the file once in the Google Picker. Students get no access; use "Share" on a roll to send a plain-text summary instead.

## Conflicts

Events are unioned by id. An `undo` cancels only the `done` ids it references. A `done` made concurrently (on another device that the undo did not see) wins, and the cell shows up in Manage > Conflicts inbox.

## Legacy

`legacy/` holds the old Python scripts and xlsx files (and a `.env`, which is git-ignored). Nothing imports them.
