# ProofPal Jobs

Fresh entry-level tech jobs: new grad roles and internships in ML, AI, software and data, for people with 0–2 years of experience. No promoted listings.

## How it works

- `scripts/companies.mjs` lists the companies, each with its public job board on Greenhouse, Lever or Ashby.
- `scripts/fetch-jobs.mjs` reads those boards, keeps roles that are internships, new grad or ask for at most 2 years of experience, tags them (ML & AI, Software, Data, region, remote) and writes `public/jobs.json`.
- A GitHub Action runs the script every hour and commits `public/jobs.json` when it changes. Vercel redeploys on that commit.
- The site (`src/`) is a static Vite + React app that reads `jobs.json`. Filters live in the URL, so links like `/?role=ml&where=India` can be shared.

## Develop

```bash
npm install
npm run fetch-jobs
npm run dev
```

## Add a company

Find its board token (the part after `boards.greenhouse.io/`, `jobs.lever.co/` or `jobs.ashbyhq.com/`) and add a line to `scripts/companies.mjs`.
