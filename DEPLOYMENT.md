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
cd playmate

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

| Variable | Value |
| --- | --- |
| `BACKEND_PORT` | `8080` |
| `PORT` | `8080` |
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://aws-1-ap-south-1.pooler.supabase.com:5432/postgres` |
| `SPRING_DATASOURCE_USERNAME` | Your Supabase username |
| `SPRING_DATASOURCE_PASSWORD` | Your Supabase password |
| `JWT_SECRET` | Your JWT secret |
| `JWT_EXPIRATION` | `3600000` |
| `REDIS_HOST` | Your Redis Cloud host |
| `REDIS_PORT` | Your Redis Cloud port |
| `REDIS_PASSWORD` | Your Redis Cloud password |
| `CLOUDINARY_CLOUD_NAME` | `playmate` |
| `CLOUDINARY_API_KEY` | Your Cloudinary key |
| `CLOUDINARY_API_SECRET` | Your Cloudinary secret |
| `BREVO_API_KEY` | Your Brevo key |
| `BREVO_SENDER_EMAIL` | Your sender email |
| `BREVO_SENDER_NAME` | `PlayMate` |
| `FIREBASE_PROJECT_ID` | `playmate-4b25d` |
| `PLAYMATE_MSG_ENCRYPTION_KEY` | Your AES-256 key |
| `ALLOWED_ORIGINS` | `https://playmate.vercel.app` (update after Vercel deploy) |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | *(see below)* |

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
| `VITE_APP_NAME` | `PlayMate` |
| `VITE_API_BASE_URL` | `https://playmate-backend.onrender.com/api` |
| `VITE_WS_BASE_URL` | `https://playmate-backend.onrender.com/ws` |
| `VITE_FIREBASE_API_KEY` | `AIzaSyCNCUNhrFF57xl0HcNAN3pqKAihJrBWiWk` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `playmate-4b25d.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `playmate-4b25d` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `playmate-4b25d.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `189801490683` |
| `VITE_FIREBASE_APP_ID` | `1:189801490683:web:eb10870d14c599272fa85e` |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-S2DV3CL17V` |
| `VITE_CLOUDINARY_CLOUD_NAME` | `playmate` |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | `playmate-upload` |

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

| Variable | Description | Example |
| --- | --- | --- |
| `BACKEND_PORT` | Server port | `8080` |
| `PORT` | Render uses this | `8080` |
| `SPRING_PROFILES_ACTIVE` | Active profile | `prod` |
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL | `jdbc:postgresql://...` |
| `SPRING_DATASOURCE_USERNAME` | DB username | `postgres.xxxxx` |
| `SPRING_DATASOURCE_PASSWORD` | DB password | `***` |
| `JWT_SECRET` | JWT signing key | `***` |
| `JWT_EXPIRATION` | Token TTL (ms) | `3600000` |
| `REDIS_HOST` | Redis host | `redis-xxxxx.cloud.redislabs.com` |
| `REDIS_PORT` | Redis port | `17229` |
| `REDIS_PASSWORD` | Redis password | `***` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud | `playmate` |
| `CLOUDINARY_API_KEY` | Cloudinary key | `***` |
| `CLOUDINARY_API_SECRET` | Cloudinary secret | `***` |
| `BREVO_API_KEY` | Brevo email key | `***` |
| `BREVO_SENDER_EMAIL` | From email | `playmate2official@gmail.com` |
| `BREVO_SENDER_NAME` | From name | `PlayMate` |
| `FIREBASE_PROJECT_ID` | Firebase project | `playmate-4b25d` |
| `PLAYMATE_MSG_ENCRYPTION_KEY` | AES-256 key | `***` |
| `ALLOWED_ORIGINS` | CORS origins | `https://playmate.vercel.app` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Firebase SA JSON | `{"type":"service_account",...}` |

### Frontend (Vercel)

| Variable | Description | Example |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend API URL | `https://playmate-backend.onrender.com/api` |
| `VITE_WS_BASE_URL` | WebSocket URL | `https://playmate-backend.onrender.com/ws` |
| `VITE_FIREBASE_API_KEY` | Firebase API key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `xxx.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | `playmate-4b25d` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage | `xxx.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | `189801490683` |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | `1:189801490683:web:...` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics ID | `G-S2DV3CL17V` |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud | `playmate` |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Upload preset | `playmate-upload` |

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
