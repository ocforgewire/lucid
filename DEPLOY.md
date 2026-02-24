# Lucid — Deployment Guide

## Marketing Site (LIVE)
**URL:** https://ocforgewire.github.io/lucid/
**Host:** GitHub Pages (auto-deploys on push to main)

## API Server

### Option 1: Render (Recommended)
1. Go to https://dashboard.render.com/
2. Click "New" → "Web Service"
3. Connect the GitHub repo: `ocforgewire/lucid`
4. Settings:
   - **Runtime:** Docker
   - **Branch:** main
   - **Plan:** Free
5. Add environment variables:
   - `DATABASE_URL` = (from .env)
   - `ANTHROPIC_API_KEY` = (from .env)
   - `JWT_SECRET` = (from .env)
   - `STRIPE_SECRET_KEY` = (from .env)
   - `NODE_ENV` = production
   - `PORT` = 3001
   - `CORS_ORIGINS` = https://ocforgewire.github.io
   - `API_URL` = (the Render URL once created)
   - `WEB_URL` = https://ocforgewire.github.io/lucid

### Option 2: Railway
1. Run `railway login` in terminal (opens browser)
2. `railway init` → Create new project
3. `railway up` → Deploy from Dockerfile
4. Add env vars from .env in Railway dashboard

### Option 3: Any Docker Host
```bash
docker build -t lucid-api .
docker run -p 3001:3001 --env-file .env lucid-api
```

## Chrome Extension
1. Go to chrome://extensions/
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select `packages/extension/dist/`

## Environment Variables Required
See `.env` file for all required variables.
