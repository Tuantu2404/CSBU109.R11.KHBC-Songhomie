# Songhomie

Songhomie is a community platform for analyzing audio, learning guitar chords,
and creating and sharing chord sheets.

## Features

- Analyze uploaded audio files to detect chords and synchronize lyrics.
- Save AI analysis results to the song library.
- Create and publish chord sheets with Song Producer.
- Practice songs with synchronized lyrics, chords, and an interactive guitar
  fretboard.
- Browse AI-analyzed songs and community creations.
- Sign in to publish songs and participate in the community.

## Technology

- **Frontend:** React, Vite, Tailwind CSS, Axios, and React Router.
- **Backend:** Node.js, Express, MongoDB Atlas, Mongoose, JWT, and Cloudinary.
- **Audio analysis:** Python, Librosa, Faster-Whisper, and supporting audio
  tools.

## Run locally

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Backend

```powershell
cd backend
npm install
npm run dev
```

Configure the backend environment variables in `backend/.env`. See
[backend/README.md](backend/README.md) for the required variable names. To use
the local frontend with a non-default API URL, set `VITE_API_URL` in the
frontend environment; it must end in `/api`.

## Deployment

Deploy the backend to Render and the frontend to Vercel. The frontend calls the
backend API, and the backend connects to MongoDB Atlas; the browser does not
connect to the database directly.

### Render backend

- **Root Directory:** `backend`
- **Runtime:** Docker
- **Health Check Path:** `/api/health`
- Configure `MONGO_URI`, `JWT_SECRET`, the Cloudinary variables, and
  `CORS_ORIGINS`.
- Set `CORS_ORIGINS` to the exact Vercel site origin, without a trailing slash,
  path, or `/api`. For the current production site:
  `https://csbu-109-r11-khbc-songhomie.vercel.app`
- If allowing more than one frontend origin, separate the origins with commas.

### Vercel frontend

- **Root Directory:** `frontend`
- **Production Branch:** `release`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- Set the `VITE_API_URL` environment variable for Production to:
  `https://csbu109-r11-khbc-songhomie.onrender.com/api`

`VITE_API_URL` must include `/api`. It is embedded in the frontend at build
time, so redeploy the Vercel project after adding or changing it. Redeploy the
Render service after changing its environment variables.

## Verify the deployment

1. Open `https://csbu109-r11-khbc-songhomie.onrender.com/api/health` and
   confirm the API responds successfully.
2. Open the Vercel site and check the browser's Network panel for the
   `.../api/songs` request. It should return HTTP 200.
3. If the browser reports a CORS error, verify the Vercel origin is included in
   Render's `CORS_ORIGINS`. If the request targets `localhost`, verify
   `VITE_API_URL` on Vercel and redeploy.
