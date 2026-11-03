# Rynovi Jobs

Fresh entry-level tech jobs: new grad roles and internships in ML, AI, software and data, for people with 0–2 years of experience. No promoted listings.

## How it works

- `scripts/companies.mjs` lists the companies we picked by hand, each with its public job board (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, or Amazon and Microsoft by country).
- `scripts/discover-boards.mjs` finds more: the public new grad and internship lists on GitHub (SimplifyJobs) link each role to the company's own board. Only the board is kept, in `scripts/boards.json`; the jobs themselves are always read from the company. It runs weekly.
- `scripts/fetch-jobs.mjs` reads every board, keeps roles that are internships, new grad or ask for at most 2 years of experience, tags them (ML & AI, Software, Data) and writes `public/jobs.json`.
- `scripts/geo.mjs` turns each location into countries and a remote flag, and reads the description for visa sponsorship and US-citizens-only roles.
- A GitHub Action runs every 3 hours and commits `public/jobs.json` when it changes. Vercel redeploys on that commit.
- The site (`src/`) is a static Vite + React app that reads `jobs.json`. Filters live in the URL, so links like `/?role=ml&country=Canada&remote=1` can be shared.

## Develop

```bash
npm install
npm run fetch-jobs
npm run dev
```

## Add a company

Find its board token (the part after `boards.greenhouse.io/`, `jobs.lever.co/` or `jobs.ashbyhq.com/`) and add a line to `scripts/companies.mjs`.
