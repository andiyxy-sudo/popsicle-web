# Popsicle Web App

Revenue Intelligence OS — web frontend for portal.popsicle-labs.app

Stack: Next.js 16 · TypeScript · Tailwind · Supabase SSR · Anthropic API
Supabase project: jvxfcvkxaqwcnkrxexso

---

## Deploy to Vercel (one-time)

### 1. Push to GitHub

git init
git add .
git commit -m "init: popsicle web app"
git remote add origin https://github.com/popsicle-labs/popsicle-web.git
git push -u origin main

### 2. Import in Vercel

Go to vercel.com/new, import the repo. Framework: Next.js (auto-detected).

### 3. Environment variables in Vercel

NEXT_PUBLIC_SUPABASE_URL = https://jvxfcvkxaqwcnkrxexso.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = From Supabase dashboard > Settings > API
ANTHROPIC_API_KEY = Your Anthropic API key

### 4. Custom domain

Add portal.popsicle-labs.app in Vercel > Domains. CNAME to cname.vercel-dns.com.

---

## OAuth redirect URIs to register

### Google Cloud Console (Gmail + GCal)
Add to Authorized redirect URIs:
  https://portal.popsicle-labs.app/auth/callback/gmail
  https://portal.popsicle-labs.app/auth/callback/gcal

### Slack (api.slack.com)
Add to Redirect URLs:
  https://portal.popsicle-labs.app/auth/callback/slack

### Zoom Marketplace
Add to Redirect URL:
  https://portal.popsicle-labs.app/auth/callback/zoom

---

## After deploy: update signal-link EF

Update the desktop branch to point to the web app:
  const webAppUrl = `https://portal.popsicle-labs.app/account/${accountId}`
  return Response.redirect(webAppUrl, 302)

---

## Local development

cp .env.local.example .env.local
# Fill in Supabase anon key and Anthropic key
npm install
npm run dev

---

## Route map

/               -> redirects to /dashboard or /login
/login          -> email/password auth
/dashboard      -> signal feed + KPI cards
/accounts       -> account table with risk/health
/account/[id]   -> account detail: signals, transcripts, baselines
/integrations   -> connect Gmail, GCal, Slack, Zoom
/ask            -> AI chat with live account context
/settings       -> profile, password, workspace info
/auth/callback/[provider] -> OAuth return handler
/api/ask        -> Anthropic API proxy with Supabase context
