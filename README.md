# RideReady

A mobile-first cycling weather adviser built with React + Vite and the free Open-Meteo forecast and geocoding APIs.

## Run locally

1. Install Node.js (LTS): https://nodejs.org/
2. In this folder, run `npm install`
3. Run `npm run dev`
4. Open the local URL shown in the terminal.

## Deploy free on Vercel

1. Create a GitHub account if you don't already have one.
2. Create a new GitHub repository and upload the contents of this folder.
3. Sign in at https://vercel.com/ using GitHub.
4. Choose **Add New → Project**, import the RideReady repository and deploy.
5. Vercel detects Vite automatically. Build command: `npm run build`; output directory: `dist`.

The deployed site will have an HTTPS address. Browser location permission works on HTTPS (or localhost). If a user declines location access, manual town/city search remains available.

## Notes

- No API key is required for the Open-Meteo endpoints used here. Review Open-Meteo's terms and attribution requirements before public/commercial launch: https://open-meteo.com/en/terms
- Preferences are stored in the visitor's browser using localStorage.
- The score is an early prototype heuristic, not a safety assessment or validated cycling metric. Severe weather alerts, ice and road conditions need further work before relying on this app.
