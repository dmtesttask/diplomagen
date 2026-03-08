# DiplomaGen

A web application for bulk diploma generation. Upload an Excel participant list and a diploma template, visually position text fields, and generate one PDF diploma per participant packaged into a downloadable ZIP archive.

## Repository Structure

```
diplomagen/
├── frontend/          # Angular 21 application
├── functions/         # GCP Cloud Functions (Node.js 22 + Express)
├── shared/            # Shared TypeScript type definitions
└── .github/workflows/ # CI/CD pipelines
```

## Prerequisites

- Node.js 22 LTS (use `nvm use` or `.nvmrc`)
- npm 10+
- Firebase CLI: `npm install -g firebase-tools`
- Angular CLI: `npm install -g @angular/cli`

## Quick Start

### 1. Configure Firebase

Copy `frontend/src/environments/environment.ts.example` to `environment.ts` and fill in your Firebase project config.

Copy `functions/.env.local.example` to `functions/.env.local` and fill in your GCS bucket name and other variables.

### 2. Install Dependencies

```bash
# Shared package
cd shared && npm install && npm run build

# Frontend
cd frontend && npm install

# Backend
cd functions && npm install
```

### 3. Run Locally

```bash
# Terminal 1 — Start Firebase emulators
firebase emulators:start --only functions,firestore,auth,storage

# Terminal 2 — Start Angular dev server
cd frontend && npm run start
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 + Angular Material (Azure & Blue) |
| Canvas editor | Fabric.js 6 |
| Authentication | Firebase Authentication (Google OAuth) |
| Database | Google Cloud Firestore |
| File storage | Google Cloud Storage |
| Backend | Node.js 22 + Express (GCP Cloud Functions 2nd gen) |
| PDF generation | pdf-lib |
| Excel parsing | SheetJS (xlsx 0.18.5) |
| Image processing | sharp |
| ZIP creation | archiver |
| i18n | Angular i18n (Ukrainian + English) |
