# DiplomaGen — Project Structure and Dependency Recommendations

> Version: 1.0  
> Date: March 7, 2026  
> Supplements: PROJECT_DOCUMENTATION.md, TECHNICAL_SPEC.md

---

## Table of Contents

1. [Repository Layout](#1-repository-layout)
2. [Frontend Folder Structure (Angular)](#2-frontend-folder-structure-angular)
3. [Backend Folder Structure (Cloud Functions)](#3-backend-folder-structure-cloud-functions)
4. [Frontend Dependencies](#4-frontend-dependencies)
5. [Backend Dependencies](#5-backend-dependencies)
6. [Shared Dev Tooling](#6-shared-dev-tooling)
7. [Environment Variables Reference](#7-environment-variables-reference)

---

## 1. Repository Layout

The project is a **monorepo** — one Git repository with two top-level workspaces: `frontend/` and `functions/`. This keeps the Angular app and Cloud Functions versions in sync, allows shared TypeScript types, and simplifies CI/CD.

```
diplomagen/                          ← repository root
│
├── frontend/                        ← Angular application
├── functions/                       ← GCP Cloud Functions (Express)
├── shared/                          ← shared TypeScript type definitions
│                                       (used by both frontend and functions)
│
├── .github/
│   └── workflows/
│       ├── pr-checks.yml            ← lint + test on every PR
│       ├── deploy-frontend.yml      ← deploy to Firebase Hosting on merge to main
│       └── deploy-functions.yml     ← deploy Cloud Functions on merge to main
│
├── .firebaserc                      ← Firebase project alias config
├── firebase.json                    ← Firebase Hosting + Functions routing config
├── .gitignore
└── README.md
```

### Why a monorepo?

- The `shared/` folder contains TypeScript interfaces for `Project`, `Field`, `GenerationJob`, etc. Both the Angular services and the Cloud Functions use the same types, so there is no risk of the frontend and backend drifting out of sync on data shapes.
- A single `firebase.json` handles both hosting and functions deployment.
- CI/CD workflows can detect which workspace changed and deploy only what is needed.

---

## 2. Frontend Folder Structure (Angular)

```
frontend/
├── .angular/                        ← Angular CLI cache (gitignored)
├── dist/                            ← build output (gitignored)
├── node_modules/                    ← (gitignored)
│
├── src/
│   ├── app/
│   │   │
│   │   ├── core/                    ← singleton services, app-wide concerns
│   │   │   ├── auth/
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── auth.guard.ts
│   │   │   ├── api/
│   │   │   │   ├── api.service.ts   ← base HTTP service (base URL, token attach)
│   │   │   │   └── auth.interceptor.ts
│   │   │   ├── error/
│   │   │   │   └── error-handler.service.ts
│   │   │   └── core.module.ts       ← imported once in AppModule
│   │   │
│   │   ├── features/                ← one subfolder per feature/epic
│   │   │   │
│   │   │   ├── auth/                ← EPIC 2: Authentication
│   │   │   │   ├── login-page/
│   │   │   │   │   ├── login-page.component.ts
│   │   │   │   │   ├── login-page.component.html
│   │   │   │   │   └── login-page.component.scss
│   │   │   │   └── auth.routes.ts
│   │   │   │
│   │   │   ├── projects/            ← EPIC 3: Project Management
│   │   │   │   ├── project-list-page/
│   │   │   │   │   ├── project-list-page.component.ts
│   │   │   │   │   ├── project-list-page.component.html
│   │   │   │   │   └── project-list-page.component.scss
│   │   │   │   ├── project-card/
│   │   │   │   │   ├── project-card.component.ts
│   │   │   │   │   ├── project-card.component.html
│   │   │   │   │   └── project-card.component.scss
│   │   │   │   ├── create-project-dialog/
│   │   │   │   │   ├── create-project-dialog.component.ts
│   │   │   │   │   └── create-project-dialog.component.html
│   │   │   │   ├── project.service.ts
│   │   │   │   └── projects.routes.ts
│   │   │   │
│   │   │   ├── workspace/           ← Project workspace (template + excel upload)
│   │   │   │   ├── workspace-page/
│   │   │   │   │   ├── workspace-page.component.ts
│   │   │   │   │   ├── workspace-page.component.html
│   │   │   │   │   └── workspace-page.component.scss
│   │   │   │   ├── template-upload/  ← EPIC 4
│   │   │   │   │   ├── template-upload.component.ts
│   │   │   │   │   ├── template-upload.component.html
│   │   │   │   │   └── template-upload.component.scss
│   │   │   │   ├── excel-upload/     ← EPIC 5
│   │   │   │   │   ├── excel-upload.component.ts
│   │   │   │   │   ├── excel-upload.component.html
│   │   │   │   │   └── excel-upload.component.scss
│   │   │   │   ├── fields-manager/   ← EPIC 5: define + map fields
│   │   │   │   │   ├── fields-manager.component.ts
│   │   │   │   │   └── column-mapping/
│   │   │   │   │       ├── column-mapping.component.ts
│   │   │   │   │       └── column-mapping.component.html
│   │   │   │   └── workspace.routes.ts
│   │   │   │
│   │   │   ├── editor/              ← EPIC 6: Visual Field Placement Editor
│   │   │   │   ├── editor-page/
│   │   │   │   │   ├── editor-page.component.ts
│   │   │   │   │   ├── editor-page.component.html
│   │   │   │   │   └── editor-page.component.scss
│   │   │   │   ├── canvas/
│   │   │   │   │   ├── canvas.component.ts      ← wraps Fabric.js
│   │   │   │   │   ├── canvas.component.html
│   │   │   │   │   └── fabric.service.ts        ← Fabric.js instance management
│   │   │   │   ├── field-sidebar/
│   │   │   │   │   ├── field-sidebar.component.ts
│   │   │   │   │   └── field-sidebar.component.html
│   │   │   │   ├── style-panel/
│   │   │   │   │   ├── style-panel.component.ts
│   │   │   │   │   └── style-panel.component.html
│   │   │   │   ├── preview-dialog/
│   │   │   │   │   ├── preview-dialog.component.ts
│   │   │   │   │   └── preview-dialog.component.html
│   │   │   │   └── editor.routes.ts
│   │   │   │
│   │   │   └── generation/          ← EPIC 7: Batch Generation + Download
│   │   │       ├── generation-panel/
│   │   │       │   ├── generation-panel.component.ts
│   │   │       │   └── generation-panel.component.html
│   │   │       ├── progress-dialog/
│   │   │       │   ├── progress-dialog.component.ts
│   │   │       │   └── progress-dialog.component.html
│   │   │       └── generation.service.ts
│   │   │
│   │   ├── shared/                  ← reusable components, pipes, directives
│   │   │   ├── components/
│   │   │   │   ├── confirm-dialog/
│   │   │   │   │   ├── confirm-dialog.component.ts
│   │   │   │   │   └── confirm-dialog.component.html
│   │   │   │   ├── file-drop-zone/
│   │   │   │   │   ├── file-drop-zone.component.ts
│   │   │   │   │   └── file-drop-zone.component.html
│   │   │   │   ├── progress-bar/
│   │   │   │   │   └── progress-bar.component.ts
│   │   │   │   └── empty-state/
│   │   │   │       ├── empty-state.component.ts
│   │   │   │       └── empty-state.component.html
│   │   │   ├── pipes/
│   │   │   │   ├── file-size.pipe.ts            ← formats bytes → "2.4 MB"
│   │   │   │   └── time-ago.pipe.ts
│   │   │   └── shared.module.ts
│   │   │
│   │   ├── layout/
│   │   │   ├── navbar/
│   │   │   │   ├── navbar.component.ts
│   │   │   │   └── navbar.component.html
│   │   │   └── layout.component.ts              ← shell with <router-outlet>
│   │   │
│   │   ├── app.component.ts
│   │   ├── app.component.html
│   │   ├── app.config.ts                        ← provideRouter, provideFirebase, etc.
│   │   └── app.routes.ts                        ← top-level lazy routes
│   │
│   ├── environments/
│   │   ├── environment.ts                       ← development config
│   │   └── environment.prod.ts                  ← production config
│   │
│   ├── i18n/
│   │   ├── messages.uk.xlf                      ← Ukrainian (source/default)
│   │   └── messages.en.xlf                      ← English translations
│   │
│   ├── assets/
│   │   ├── icons/
│   │   └── images/
│   │
│   ├── styles/
│   │   ├── _variables.scss                      ← design tokens (colors, spacing)
│   │   ├── _typography.scss
│   │   └── styles.scss                          ← global styles entry point
│   │
│   ├── index.html
│   └── main.ts
│
├── angular.json
├── tsconfig.json
├── tsconfig.app.json
├── package.json
└── .eslintrc.json
```

---

## 3. Backend Folder Structure (Cloud Functions)

```
functions/
├── node_modules/                    ← (gitignored)
├── dist/                            ← compiled JS output (gitignored)
│
├── src/
│   ├── index.ts                     ← Cloud Function entry point; exports the Express app
│   │                                   as a single Cloud Function named "api"
│   │
│   ├── app.ts                       ← Express app factory (createApp())
│   │                                   registers middleware and all routers
│   │
│   ├── middleware/
│   │   ├── authenticate.ts          ← verifies Firebase ID token on every request
│   │   ├── validate.ts              ← generic request body validation middleware
│   │   └── error-handler.ts        ← global Express error handler
│   │
│   ├── routes/
│   │   ├── health.router.ts
│   │   ├── projects.router.ts       ← /projects CRUD
│   │   ├── template.router.ts       ← /projects/:id/template/*
│   │   ├── excel.router.ts          ← /projects/:id/excel
│   │   ├── fields.router.ts         ← /projects/:id/fields
│   │   ├── preview.router.ts        ← /projects/:id/preview
│   │   ├── generate.router.ts       ← /projects/:id/generate
│   │   └── jobs.router.ts           ← /projects/:id/jobs/:jobId
│   │
│   ├── services/
│   │   ├── firestore.service.ts     ← Firestore read/write helpers
│   │   ├── storage.service.ts       ← Cloud Storage signed URL helpers
│   │   ├── excel.service.ts         ← SheetJS parsing logic
│   │   ├── template.service.ts      ← sharp + pdf-lib dimension resolution
│   │   ├── pdf.service.ts           ← core pdf-lib diploma rendering logic
│   │   ├── font.service.ts          ← font loading and caching
│   │   └── zip.service.ts           ← archiver ZIP creation
│   │
│   ├── triggers/
│   │   └── on-user-create.ts        ← Firebase Auth onCreate trigger
│   │                                   creates User document in Firestore
│   │
│   └── types/                       ← re-exports from shared/ for backend use
│       └── index.ts
│
├── assets/
│   └── fonts/
│       ├── PTSerif/
│       │   ├── PTSerif-Regular.ttf
│       │   ├── PTSerif-Bold.ttf
│       │   ├── PTSerif-Italic.ttf
│       │   └── PTSerif-BoldItalic.ttf
│       ├── PTSans/
│       │   ├── PTSans-Regular.ttf
│       │   ├── PTSans-Bold.ttf
│       │   ├── PTSans-Italic.ttf
│       │   └── PTSans-BoldItalic.ttf
│       ├── Roboto/
│       │   ├── Roboto-Regular.ttf
│       │   ├── Roboto-Bold.ttf
│       │   ├── Roboto-Italic.ttf
│       │   └── Roboto-BoldItalic.ttf
│       ├── OpenSans/
│       │   ├── OpenSans-Regular.ttf
│       │   ├── OpenSans-Bold.ttf
│       │   ├── OpenSans-Italic.ttf
│       │   └── OpenSans-BoldItalic.ttf
│       └── TimesNewRoman/
│           ├── times.ttf
│           ├── timesbd.ttf
│           ├── timesi.ttf
│           └── timesbi.ttf
│
├── package.json
├── tsconfig.json
└── .eslintrc.json
```

---

## 4. Frontend Dependencies

### Runtime `dependencies`

#### Core Angular

| Package | Recommended Version | Notes |
|---|---|---|
| `@angular/core` | `^21.0.0` | Latest stable as of Q1 2026 |
| `@angular/common` | `^21.0.0` | |
| `@angular/forms` | `^21.0.0` | Reactive forms for all inputs |
| `@angular/router` | `^21.0.0` | Lazy-loaded feature routes |
| `@angular/platform-browser` | `^21.0.0` | |
| `@angular/platform-browser-dynamic` | `^21.0.0` | |
| `@angular/localize` | `^21.0.0` | Required for i18n |

#### Angular Material (UI component library)

| Package | Recommended Version | Notes |
|---|---|---|
| `@angular/material` | `^21.0.0` | Must match Angular version |
| `@angular/cdk` | `^21.0.0` | Required peer dependency of Material |

Angular Material is chosen over alternatives (PrimeNG, NGZorro) because it has first-party support from the Angular team, follows Material Design 3 (modern, clean aesthetic suitable for a SaaS tool), and has the best long-term maintenance guarantee.

#### Firebase / GCP

| Package | Recommended Version | Notes |
|---|---|---|
| `firebase` | `^11.0.0` | Firebase JS SDK v11 (modular API) |
| `@angular/fire` | `^21.0.0` | AngularFire — must match Angular version |

AngularFire v18+ uses the modular Firebase SDK and integrates natively with Angular's `inject()`. It provides real-time Firestore observables needed for job progress tracking.

#### Canvas Editor

| Package | Recommended Version | Notes |
|---|---|---|
| `fabric` | `^6.4.0` | Fabric.js v6 (stable). v6 introduced full ESM support and significantly improved TypeScript types vs v5 |
| `@types/fabric` | `^5.3.0` | Type definitions (use v5 types, they cover v6 API surface) |

**Why Fabric.js v6 and not v5?** v6 rewrote the event system and improved performance for large canvases. It also ships proper TypeScript definitions. v5 is still widely used but v6 is stable and recommended for new projects.

**Alternative considered: Konva.js** — also a good canvas library with better React integration, but Fabric.js has better built-in text editing capabilities which are needed for this project.

#### RxJS

| Package | Recommended Version | Notes |
|---|---|---|
| `rxjs` | `^7.8.0` | Angular 21 peer requires rxjs ^7.4. v7.8 is the latest stable 7.x |

### Runtime `devDependencies` (Frontend)

| Package | Recommended Version | Notes |
|---|---|---|
| `@angular/cli` | `^21.0.0` | |
| `@angular/compiler-cli` | `^21.0.0` | |
| `typescript` | `~5.7.0` | Angular 21 requires TypeScript ≥ 5.5, < 5.8 |
| `@types/node` | `^22.0.0` | For Node.js types in Angular build scripts |
| `eslint` | `^9.0.0` | |
| `@typescript-eslint/parser` | `^8.0.0` | |
| `@typescript-eslint/eslint-plugin` | `^8.0.0` | |
| `prettier` | `^3.3.0` | |
| `eslint-config-prettier` | `^9.0.0` | Disables ESLint rules that conflict with Prettier |
| `jest` | `^29.7.0` | Unit testing (Note: test writing is deferred to the end of the project) |
| `jest-preset-angular` | `^14.0.0` | Angular preset for Jest |
| `@testing-library/angular` | `^17.0.0` | Component testing utilities |

---

## 5. Backend Dependencies

### Runtime `dependencies` (Cloud Functions)

#### Runtime

| Package | Recommended Version | Notes |
|---|---|---|
| `node` (engine) | `>=22.0.0` | Node 22 LTS. Specified in `package.json` `engines` field |

#### HTTP / Framework

| Package | Recommended Version | Notes |
|---|---|---|
| `express` | `^4.21.0` | Express 4.x. Express 5 released in 2024 but still has rough edges in serverless environments; stick with v4 for stability |
| `@types/express` | `^4.17.0` | TypeScript types |
| `cors` | `^2.8.5` | CORS middleware for cross-origin Angular requests |
| `multer` | `^1.4.5` | Multipart form data parsing (Excel file upload endpoint) |
| `@types/multer` | `^1.4.12` | |

#### Firebase / GCP Admin

| Package | Recommended Version | Notes |
|---|---|---|
| `firebase-admin` | `^13.0.0` | Firebase Admin SDK v13. Used for: Auth token verification, Firestore writes, triggering cleanup |
| `firebase-functions` | `^6.0.0` | GCP Cloud Functions v6 SDK. Required to export the Express app as a Cloud Function |
| `@google-cloud/storage` | `^7.0.0` | Google Cloud Storage client. Used for signed URLs, file upload, delete |

#### PDF Generation

| Package | Recommended Version | Notes |
|---|---|---|
| `pdf-lib` | `^1.17.1` | The most capable pure-JS PDF library. No native dependencies — works in serverless without issue. v1.17.1 is the current stable release; the project is mature and unlikely to have major breaking changes |

**Why pdf-lib over alternatives?**
- `pdfkit` — older, requires streams, harder to embed images.
- `jspdf` — primarily browser-targeted, limited server-side use.
- `puppeteer` — can generate PDFs but requires Chromium, which is prohibitively large for a Cloud Function deployment package and has memory issues in serverless.
- `pdf-lib` — pure JS, no native binaries, small bundle, first-class support for embedding fonts and images. Ideal for serverless.

#### Excel Parsing

| Package | Recommended Version | Notes |
|---|---|---|
| `xlsx` | `^0.18.5` | SheetJS Community Edition. Best Excel parser available for Node.js. Handles `.xlsx`, `.xls`, `.csv`. v0.18.x is the last MIT-licensed version; **do not upgrade to v0.19+** which changed to a proprietary license |

> **Important licensing note**: SheetJS (xlsx) changed from MIT to a proprietary license in v0.19.0. Always use `^0.18.5` and pin this version explicitly in `package.json` (`"xlsx": "0.18.5"` without the caret) to avoid accidental upgrade.

#### Image Processing

| Package | Recommended Version | Notes |
|---|---|---|
| `sharp` | `^0.33.0` | High-performance image processing for Node.js. Used to get dimensions of JPEG/PNG templates and to render PDF preview images to PNG. Uses native binaries (libvips) — this is fine in Cloud Functions, but the deployment package must target `linux/amd64` |

**Deployment note for sharp**: When deploying Cloud Functions from a Windows or macOS machine, `sharp` native binaries must be rebuilt for Linux. The recommended approach is to set the npm config:
```
npm install --platform=linux --arch=x64 sharp
```
Or add to `package.json`:
```json
"optionalDependencies": {
  "@img/sharp-linux-x64": "^0.33.0"
}
```

#### ZIP Creation

| Package | Recommended Version | Notes |
|---|---|---|
| `archiver` | `^7.0.0` | Stream-based ZIP creation. The most widely used ZIP library for Node.js. v7 uses streams3 API, compatible with Node 22 |
| `@types/archiver` | `^6.0.0` | |

#### Validation

| Package | Recommended Version | Notes |
|---|---|---|
| `zod` | `^3.23.0` | Schema validation for request bodies. Preferred over `joi` or `express-validator` because it generates TypeScript types from schemas automatically — one schema definition covers both runtime validation and compile-time typing |

### `devDependencies` (Cloud Functions)

| Package | Recommended Version | Notes |
|---|---|---|
| `typescript` | `~5.7.0` | Same version as frontend for consistency |
| `ts-node` | `^10.9.0` | Run TypeScript directly during local dev |
| `@types/node` | `^22.0.0` | |
| `eslint` | `^9.0.0` | |
| `@typescript-eslint/parser` | `^8.0.0` | |
| `@typescript-eslint/eslint-plugin` | `^8.0.0` | |
| `prettier` | `^3.3.0` | |
| `jest` | `^29.7.0` | (Note: Backend tests are deferred to the end) |
| `ts-jest` | `^29.2.0` | |
| `firebase-functions-test` | `^3.3.0` | Official testing SDK for Cloud Functions |

---

## 6. Shared Dev Tooling

These tools are configured at the **repository root** and apply to both `frontend/` and `functions/`:

### `shared/` package (type sharing)

```
shared/
├── src/
│   ├── models/
│   │   ├── user.model.ts
│   │   ├── project.model.ts
│   │   ├── field.model.ts
│   │   └── generation-job.model.ts
│   └── index.ts
├── package.json       ← name: "@diplomagen/shared"
└── tsconfig.json
```

Both `frontend/package.json` and `functions/package.json` reference this package locally:
```json
"@diplomagen/shared": "file:../shared"
```

This ensures that `Project`, `Field`, `GenerationJob` interfaces are defined **once** and used everywhere.

### Node.js version

Use **Node.js 22 LTS** across the entire project (local dev, CI, Cloud Functions). Pin the version in a root `.nvmrc` file:

```
22
```

And in `functions/package.json`:
```json
"engines": {
  "node": "22"
}
```

### Package manager

Use **npm** (not Yarn or pnpm). Firebase CLI, Angular CLI, and GCP documentation all provide `npm` examples. Using npm avoids potential lockfile conflicts when copying commands from official docs.

### Git configuration

Root `.gitignore` covers:
```
node_modules/
dist/
.angular/
*.env
*.env.local
.firebase/
firebase-debug.log
```

---

## 7. Environment Variables Reference

### Frontend (`frontend/src/environments/environment.ts`)

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey:            "...",
    authDomain:        "{project-id}.firebaseapp.com",
    projectId:         "{project-id}",
    storageBucket:     "{project-id}.firebasestorage.app",
    messagingSenderId: "...",
    appId:             "..."
  },
  apiBaseUrl: "http://localhost:5001/{project-id}/{region}/api"
};
```

In `environment.prod.ts`, `apiBaseUrl` points to the deployed Cloud Function URL and `production: true`.

> These values are **not secrets** — they are intentionally embedded in the frontend bundle. Firebase security is enforced by Firestore Security Rules and Firebase Auth, not by hiding the config.

### Backend (Cloud Functions runtime environment)

Cloud Functions access these via `process.env`. Set them using:
```
firebase functions:config:set ... 
```
or via GCP Secret Manager (recommended for production).

| Variable | Description |
|---|---|
| `GCS_BUCKET_NAME` | Cloud Storage bucket name for all file storage |
| `FIREBASE_PROJECT_ID` | GCP project ID (usually auto-set in Cloud Functions runtime) |
| `ALLOWED_ORIGIN` | CORS allowed origin, e.g. `https://diplomagen.web.app` |
| `MAX_EXCEL_ROWS` | Hard limit on participant count per generation job (recommended: `1000`) |
| `SIGNED_URL_EXPIRY_MINUTES` | Expiry for download signed URLs (recommended: `15`) |
| `PREVIEW_EXPIRY_MINUTES` | Expiry for preview image signed URLs (recommended: `60`) |

For local development with the Firebase Emulator, these variables are set in `functions/.env.local` (gitignored).

---

## Version Compatibility Matrix

| Component | Version | Compatible with |
|---|---|---|
| Node.js | 22 LTS | Cloud Functions 2nd gen ✓ |
| Angular | 21.x | TypeScript 5.5–5.7 ✓ |
| AngularFire | 21.x | Firebase SDK 11.x ✓ |
| TypeScript | 5.7.x | Angular 21 ✓, Node 22 ✓ |
| Firebase SDK (client) | 11.x | AngularFire 21 ✓ |
| Firebase Admin SDK | 13.x | Node 22 ✓ |
| Fabric.js | 6.4.x | Angular 21 ✓ (no framework coupling) |
| pdf-lib | 1.17.x | Node 22 ✓ |
| sharp | 0.33.x | Node 22 ✓ |
| xlsx (SheetJS) | 0.18.5 | Node 22 ✓, MIT license ✓ |

---

*End of document.*
