# PlayMate — Deployment Guide

> **Backend → Render** (free tier) | **Frontend → Vercel** (free tier)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Prepare the Repository](#2-prepare-the-repository)
3. [Deploy Backend on Render](#3-deploy-backend-on-render)
4. [Deploy Frontend on Vercel](#4-deploy-frontend-on-vercel)
5. [Connect Frontend ↔ Backend](#5-connect-frontend--backend)
6. [Firebase Authorized Domains](#6-firebase-authorized-domains)
7. [Verify the Deployment](#7-verify-the-deployment)
8. [Environment Variables Reference](#8-environment-variables-reference)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| What                 | Where to get it                                    |
| -------------------- | -------------------------------------------------- |
| GitHub account       | [github.com](https://github.com)                   |
| Render account       | [render.com](https://render.com) — sign in with GitHub |
| Vercel account       | [vercel.com](https://vercel.com) — sign in with GitHub   |
| Project pushed to GitHub | A **private** repo with the full PlayMate project  |

> **Important:** Make sure `.env`, `firebase-service-account.json` and other secrets are in `.gitignore` and **never** pushed to GitHub.

---

## 2. Prepare the Repository

Push your project to a **private** GitHub repository if you haven't already:

```bash
cd /Users/thalakolakarthikreddy/playmate

# Initialize and push (skip if already done)
git init
git remote add origin https://github.com/YOUR_USERNAME/playmate.git
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

### Verify `.gitignore` includes:

```
.env
backend/src/main/resources/firebase-service-account.json
backend/target/
frontend/node_modules/
frontend/dist/
```

---

## 3. Deploy Backend on Render

### Step 1 — Create a new Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account and select the `playmate` repository
4. Click **"Connect"**

### Step 2 — Configure the service

| Setting | Value |
| --- | --- |
| **Name** | `playmate-backend` |
| **Region** | Singapore (Southeast Asia) or closest to you |
| **Root Directory** | `backend` |
| **Runtime** | **Docker** |
| **Instance Type** | **Free** |

> Render auto-detects the `Dockerfile` in `backend/`. No build/start commands needed.

### Step 3 — Add environment variables

Scroll down to **"Environment Variables"** and add each variable from the table below.

Click **"Add Environment Variable"** for each:

| Variable | Value (from root `.env`) |
| --- | --- |
| `PORT` | `8080` |
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `SPRING_DATASOURCE_URL` | Same as `SPRING_DATASOURCE_URL` in `.env` |
| `SPRING_DATASOURCE_USERNAME` | Same as `SPRING_DATASOURCE_USERNAME` in `.env` |
| `SPRING_DATASOURCE_PASSWORD` | Same as `SPRING_DATASOURCE_PASSWORD` in `.env` |
| `JWT_SECRET` | Same as `JWT_SECRET` in `.env` |
| `JWT_EXPIRATION` | Same as `JWT_EXPIRATION` in `.env` (e.g. `3600000`) |
| `REDIS_HOST` | Same as `REDIS_HOST` in `.env` |
| `REDIS_PORT` | Same as `REDIS_PORT` in `.env` |
| `REDIS_PASSWORD` | Same as `REDIS_PASSWORD` in `.env` |
| `CLOUDINARY_CLOUD_NAME` | Same as `CLOUDINARY_CLOUD_NAME` in `.env` |
| `CLOUDINARY_API_KEY` | Same as `CLOUDINARY_API_KEY` in `.env` |
| `CLOUDINARY_API_SECRET` | Same as `CLOUDINARY_API_SECRET` in `.env` |
| `BREVO_API_KEY` | Same as `BREVO_API_KEY` in `.env` |
| `BREVO_SENDER_EMAIL` | Same as `BREVO_SENDER_EMAIL` in `.env` |
| `BREVO_SENDER_NAME` | Same as `BREVO_SENDER_NAME` in `.env` |
| `FIREBASE_PROJECT_ID` | Same as `FIREBASE_PROJECT_ID` in `.env` |
| `PLAYMATE_MSG_ENCRYPTION_KEY` | Same as `PLAYMATE_MSG_ENCRYPTION_KEY` in `.env` |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` (update after Vercel deploy) |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | *(see below)* |

> **Note:** The variable names above are the **exact same names** as in your root `.env` file. Just copy each value directly. The only additions are `PORT` (Render requires this) and `GOOGLE_APPLICATION_CREDENTIALS_JSON` (Firebase service account for cloud). You do **not** need `BACKEND_PORT` on Render — `PORT` is sufficient.

### Step 4 — Handle Firebase Service Account on Render

Since you can't push the JSON file to GitHub, use an **environment variable**:

1. Open your local `firebase-service-account.json`
2. Copy the **entire JSON content**
3. In Render, add an environment variable:
   - **Key:** `GOOGLE_APPLICATION_CREDENTIALS_JSON`
   - **Value:** Paste the entire JSON content (single line is fine)

> The `FirebaseConfig.java` reads from this env var automatically on Render.

### Step 5 — Deploy

1. Click **"Create Web Service"**
2. Render builds the Docker image and deploys automatically
3. You'll get a URL like:
   ```
   https://playmate-backend.onrender.com
   ```
4. **Copy this URL** — you'll need it for the frontend.

### Step 6 — Verify

Test the health endpoint:
```
https://playmate-backend.onrender.com/actuator/health
```

> **Note:** On the free tier, Render spins down the service after 15 minutes of inactivity. The first request after idle takes ~30–60 seconds (cold start). This is normal for the free plan.

---

## 4. Deploy Frontend on Vercel

### Step 1 — Create a new project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your `playmate` repository

### Step 2 — Configure build settings

| Setting | Value |
| --- | --- |
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### Step 3 — Add environment variables

Go to **Settings → Environment Variables** and add:

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://playmate-backend.onrender.com/api` |
| `VITE_WS_BASE_URL` | `https://playmate-backend.onrender.com/ws` |
| `VITE_FIREBASE_API_KEY` | Your Firebase API key (from `.env` → `FIREBASE_API_KEY`) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Your Firebase auth domain (from `.env` → `FIREBASE_AUTH_DOMAIN`) |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase project ID (from `.env` → `FIREBASE_PROJECT_ID`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Your Firebase storage bucket (from `.env` → `FIREBASE_STORAGE_BUCKET`) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your FCM sender ID (from `.env` → `FIREBASE_MESSAGING_SENDER_ID`) |
| `VITE_FIREBASE_APP_ID` | Your Firebase app ID (from `.env` → `FIREBASE_APP_ID`) |
| `VITE_FIREBASE_MEASUREMENT_ID` | Your measurement ID (from `.env` → `FIREBASE_MEASUREMENT_ID`) |
| `VITE_CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name (from `.env` → `CLOUDINARY_CLOUD_NAME`) |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Your Cloudinary upload preset (e.g. `playmate-upload`) |

> **Mapping from root `.env` to Vercel:** The root `.env` uses names like `FIREBASE_API_KEY`, but Vite requires the `VITE_` prefix. Copy the **values** from your root `.env` and use the `VITE_` prefixed names above in Vercel.

### Step 4 — Deploy

1. Click **"Deploy"**
2. Vercel builds and gives you a URL like: `https://playmate.vercel.app`
3. You can set a custom domain later in **Settings → Domains**

---

## 5. Connect Frontend ↔ Backend

After both are deployed, update the cross-references:

### On Render (Backend):

Go to your Render service → **Environment** → update `ALLOWED_ORIGINS`:

```
https://playmate.vercel.app,https://playmate-YOUR_USERNAME.vercel.app
```

> Use the **exact Vercel domain(s)** you received. Click **"Save Changes"** — Render auto-redeploys.

### On Vercel (Frontend):

Make sure `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` point to your Render URL:

```
VITE_API_BASE_URL=https://playmate-backend.onrender.com/api
VITE_WS_BASE_URL=https://playmate-backend.onrender.com/ws
```

> After changing env vars on Vercel, click **"Redeploy"** from the Deployments tab.

---

## 6. Firebase Authorized Domains

Google sign-in only works from authorized domains.

1. Go to [Firebase Console](https://console.firebase.google.com) → `playmate-4b25d`
2. Navigate to **Authentication → Settings → Authorized domains**
3. Add your Vercel domain:
   ```
   playmate.vercel.app
   ```
   (and any other Vercel preview domains like `playmate-git-main-YOUR_USERNAME.vercel.app`)

---

## 7. Verify the Deployment

### Backend health check:

```
https://playmate-backend.onrender.com/actuator/health
```

Expected response:

```json
{ "status": "UP" }
```

### Frontend:

Open `https://playmate.vercel.app` — you should see the PlayMate homepage.

### Full test checklist:

- [ ] Homepage loads
- [ ] Register a new account (email/password)
- [ ] Login with Google
- [ ] View/update profile (with photo upload)
- [ ] Create a game
- [ ] Join a game
- [ ] Send messages (DM + group chat)
- [ ] Admin dashboard loads (admin user)
- [ ] Push notifications prompt appears

---

## 8. Environment Variables Reference

### Backend (Render)

| Variable | Description | Root `.env` name |
| --- | --- | --- |
| `PORT` | Server port (Render sets this) | `BACKEND_PORT` |
| `SPRING_PROFILES_ACTIVE` | Active profile | `SPRING_PROFILES_ACTIVE` |
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL | `SPRING_DATASOURCE_URL` |
| `SPRING_DATASOURCE_USERNAME` | DB username | `SPRING_DATASOURCE_USERNAME` |
| `SPRING_DATASOURCE_PASSWORD` | DB password | `SPRING_DATASOURCE_PASSWORD` |
| `JWT_SECRET` | JWT signing key | `JWT_SECRET` |
| `JWT_EXPIRATION` | Token TTL (ms) | `JWT_EXPIRATION` |
| `REDIS_HOST` | Redis host | `REDIS_HOST` |
| `REDIS_PORT` | Redis port | `REDIS_PORT` |
| `REDIS_PASSWORD` | Redis password | `REDIS_PASSWORD` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud | `CLOUDINARY_CLOUD_NAME` |
| `CLOUDINARY_API_KEY` | Cloudinary key | `CLOUDINARY_API_KEY` |
| `CLOUDINARY_API_SECRET` | Cloudinary secret | `CLOUDINARY_API_SECRET` |
| `BREVO_API_KEY` | Brevo email key | `BREVO_API_KEY` |
| `BREVO_SENDER_EMAIL` | From email | `BREVO_SENDER_EMAIL` |
| `BREVO_SENDER_NAME` | From name | `BREVO_SENDER_NAME` |
| `FIREBASE_PROJECT_ID` | Firebase project | `FIREBASE_PROJECT_ID` |
| `PLAYMATE_MSG_ENCRYPTION_KEY` | AES-256 key | `PLAYMATE_MSG_ENCRYPTION_KEY` |
| `ALLOWED_ORIGINS` | CORS origins | `ALLOWED_ORIGINS` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Firebase SA JSON | *(Render only)* |

### Frontend (Vercel)

| Variable | Description | Root `.env` name |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend API URL | *(Render URL + `/api`)* |
| `VITE_WS_BASE_URL` | WebSocket URL | *(Render URL + `/ws`)* |
| `VITE_FIREBASE_API_KEY` | Firebase API key | `FIREBASE_API_KEY` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `FIREBASE_AUTH_DOMAIN` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | `FIREBASE_PROJECT_ID` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage | `FIREBASE_STORAGE_BUCKET` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | `FIREBASE_MESSAGING_SENDER_ID` |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | `FIREBASE_APP_ID` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics ID | `FIREBASE_MEASUREMENT_ID` |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud | `CLOUDINARY_CLOUD_NAME` |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Upload preset | *(set in Cloudinary dashboard)* |

---

## 9. Troubleshooting

### "CORS error" in browser console

- Verify `ALLOWED_ORIGINS` on Render includes your exact Vercel URL (with `https://`, no trailing slash)
- Save the env var change — Render auto-redeploys

### "Firebase: Error (auth/unauthorized-domain)"

- Add your Vercel domain to Firebase Console → Authentication → Authorized domains

### Backend fails to start on Render

- Go to your service → **Logs** tab to check the error
- Ensure `PORT` is set to `8080`
- Check that `SPRING_DATASOURCE_URL` uses the Supabase **pooler** URL (IPv4-compatible)
- If Docker build fails, check that `backend/Dockerfile` exists and the `mvnw` file has execute permission

### Backend is slow on first request

- **This is normal on the free tier.** Render spins down free services after 15 min of inactivity. The first request after idle takes 30–60 seconds while the container cold-starts.
- To keep it alive for demos, you can use a free uptime monitor like [UptimeRobot](https://uptimerobot.com) to ping `https://playmate-backend.onrender.com/actuator/health` every 14 minutes.

### API calls return 404 on Vercel

- Make sure `VITE_API_BASE_URL` is set to the full Render URL including `/api`
- Redeploy the frontend after changing env vars

### WebSocket connection fails

- Ensure `VITE_WS_BASE_URL` points to `https://YOUR-RENDER-URL.onrender.com/ws`
- Render supports WebSocket connections on all tiers

### Firebase Admin SDK not initializing

- Verify `GOOGLE_APPLICATION_CREDENTIALS_JSON` is set with the **full JSON** content
- Check Render logs for `[FirebaseConfig]` messages

### Free tier limits

| Service | Free Tier Limits |
| --- | --- |
| **Render** | 750 free hours/month, 512 MB RAM, auto-sleep after 15 min idle |
| **Vercel** | 100 GB bandwidth, 6000 build minutes/month |
| **Supabase** | 500 MB DB, 1 GB file storage, 50,000 monthly active users |
| **Redis Cloud** | 30 MB, 1 database |
| **Cloudinary** | 25 credits/month (~25 GB storage + transforms) |

---

## Quick Start Summary

```
1. Push code to GitHub (private repo)
2. Render: New Web Service → root dir "backend" → runtime "Docker" → set env vars → deploy → copy URL
3. Vercel: Import repo → root dir "frontend" → set VITE_API_BASE_URL & VITE_WS_BASE_URL → deploy
4. Render: Update ALLOWED_ORIGINS with Vercel URL
5. Firebase: Add Vercel domain to authorized domains
6. Test everything ✅
```
