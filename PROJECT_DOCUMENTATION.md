# DiplomaGen — Project Documentation

> Version: 1.0  
> Date: March 7, 2026  
> Status: Pre-development  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [User Roles](#3-user-roles)
4. [High-Level User Flow](#4-high-level-user-flow)
5. [Architecture Overview](#5-architecture-overview)
6. [Tech Stack](#6-tech-stack)
7. [Data Models](#7-data-models)
8. [Epics, Stories, and Tasks](#8-epics-stories-and-tasks)
9. [Out of Scope (Future Releases)](#9-out-of-scope-future-releases)

---

## 1. Project Overview

**DiplomaGen** is a web application that helps conference and competition organizers quickly generate personalized award diplomas in bulk.

An organizer uploads a participant list in Excel format and a diploma template (PDF, JPEG, or PNG). Using a visual drag-and-placement editor, they position text fields (name, surname, patronymic, place, date, etc.) directly on top of the diploma template. Once the layout is configured, the system generates one PDF diploma per participant and packages everything into a downloadable ZIP archive.

The application is primarily aimed at the **Ukrainian market** and supports **Ukrainian (default)** and **English** languages.

---

## 2. Goals and Non-Goals

### Goals (MVP)

- Allow organizers to upload an Excel file with participant data and a diploma template.
- Provide a visual canvas editor to place data fields on the diploma with pixel-level control.
- Support full text styling per field: font family, font size, color, bold, italic.
- Allow organizers to map Excel columns to diploma fields manually.
- Generate individual PDF diplomas for every row in the Excel file.
- Package all generated PDFs into a single downloadable ZIP file.
- Allow users to sign in with Google OAuth and save/reload their diploma projects.
- Support Ukrainian (default) and English UI languages.

### Non-Goals (MVP — deferred to future releases)

- Google Drive export (planned for v1.1).
- Sending diplomas directly by email to participants.
- Team or multi-user collaboration on a single project.
- Payment / subscription billing.
- Mobile-first or native mobile application.
- Support for formats other than PDF output (e.g., DOCX, PNG per diploma).

---

## 3. User Roles

### Organizer (primary user)

A person who runs a conference, competition, or educational event. They:
- Create and manage diploma projects.
- Upload templates and participant Excel files.
- Configure field placement and text styling.
- Generate and download diplomas.

> In MVP, there is only one role. Admin functionality and team roles are deferred.

---

## 4. High-Level User Flow

```
1. User visits the app → signs in with Google account
2. User creates a new Project (gives it a name)
3. User uploads a diploma template (PDF, JPEG, or PNG)
4. User uploads an Excel file with participant data
5. User maps Excel columns to diploma fields
   (e.g., column "A" → "First Name", column "B" → "Last Name")
6. User opens the visual field editor
   - The diploma template is shown as a canvas background
   - User drags data field labels onto the canvas and positions them
   - For each field, user configures: font, size, color, bold, italic, alignment
7. User previews a single diploma with real data from any Excel row
8. User clicks "Generate All" → system creates one PDF per row
9. System bundles all PDFs into a ZIP file → user downloads it
10. Project (template, column mapping, field positions, styles) is saved
    and can be reloaded and reused later
```

---

## 5. Architecture Overview

The application follows a **client–serverless-backend** architecture hosted on **Google Cloud Platform**.

```
┌──────────────────────────────────────────────────────────┐
│                     Browser (Angular)                     │
│                                                          │
│  Auth (Google OAuth)  │  Canvas Editor  │  Project UI   │
└────────────┬─────────────────────────────────────────────┘
             │ HTTPS (REST API)
┌────────────▼─────────────────────────────────────────────┐
│              GCP Cloud Functions (Node.js)                │
│                                                          │
│  /upload-template   /parse-excel   /generate-diplomas    │
│  /projects (CRUD)                                        │
└──────┬───────────────────┬───────────────────────────────┘
       │                   │
┌──────▼──────┐    ┌───────▼──────────┐
│  Firestore  │    │  Cloud Storage   │
│  (projects, │    │  (templates,     │
│   users)    │    │   generated ZIPs)│
└─────────────┘    └──────────────────┘
```

### Key Architectural Decisions

- **Frontend (Angular)**: Handles all UI rendering, the canvas editor using HTML5 Canvas or a library like Fabric.js, file selection, and API calls.
- **Cloud Functions (Node.js/Express)**: Stateless serverless functions handle file processing, Excel parsing, and PDF generation. Each function is independently deployable.
- **Firestore**: NoSQL database storing user profiles and saved projects (metadata, column mappings, field positions, styles). Does not store binary files.
- **Cloud Storage**: Stores uploaded template images/PDFs and generated ZIP archives. Files have time-limited signed URLs for secure download.
- **Google OAuth**: Authentication is handled via Firebase Authentication (backed by Google OAuth), which integrates natively with GCP.

---

## 6. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend framework | Angular (latest stable) | Required by client |
| Frontend canvas editor | Fabric.js | Powerful interactive canvas, works well in Angular |
| Frontend HTTP | Angular HttpClient | Built-in |
| Frontend i18n | Angular i18n (built-in) | Native support for multi-language |
| Authentication | Firebase Authentication + Google OAuth | Native GCP integration |
| Backend runtime | Node.js 20 | GCP Cloud Functions support |
| Backend framework | Express.js (inside Cloud Function) | Required by client, easy routing |
| PDF generation | pdf-lib | Pure JS, no native dependencies, runs in serverless |
| Excel parsing | xlsx (SheetJS) | Widely used, handles .xlsx and .xls |
| Image processing | sharp | Convert JPEG/PNG templates to canvas-compatible format |
| Database | Google Cloud Firestore | Serverless, scales to zero, native GCP |
| File storage | Google Cloud Storage | Stores templates and output ZIPs |
| Hosting (frontend) | Firebase Hosting | Free tier, CDN, integrates with the rest of GCP |
| ZIP creation | archiver (Node.js) | Stream-based ZIP creation |
| Deployment | GCP Cloud Functions (2nd gen) | Serverless, pay-per-use |

---

## 7. Data Models

### User
```
User {
  uid: string            // Google OAuth UID (from Firebase Auth)
  email: string
  displayName: string
  photoURL: string
  createdAt: timestamp
}
```

### Project
```
Project {
  id: string             // Auto-generated Firestore document ID
  ownerId: string        // Reference to User.uid
  name: string           // e.g. "Regional Math Olympiad 2026"
  createdAt: timestamp
  updatedAt: timestamp

  template: {
    storageUrl: string   // GCS path to uploaded template file
    mimeType: string     // "application/pdf" | "image/jpeg" | "image/png"
    widthPx: number      // Template width in pixels (resolved on upload)
    heightPx: number     // Template height in pixels
  }

  excelColumns: string[] // Column headers extracted from uploaded Excel
                         // e.g. ["Прізвище", "Ім'я", "По батькові", "Місце"]

  fields: Field[]        // Configured diploma fields (see below)
}
```

### Field
```
Field {
  id: string             // e.g. "field_1"
  label: string          // Display label in editor, e.g. "First Name"
  excelColumn: string    // Matched Excel column header
  
  position: {
    x: number            // X coordinate on canvas (pixels from top-left)
    y: number            // Y coordinate on canvas (pixels from top-left)
  }

  style: {
    fontFamily: string   // e.g. "Arial", "Times New Roman"
    fontSize: number     // in points
    color: string        // hex color, e.g. "#1A1A1A"
    bold: boolean
    italic: boolean
    align: "left" | "center" | "right"
  }
}
```

### GenerationJob (transient, not persisted long-term)
```
GenerationJob {
  id: string
  projectId: string
  status: "pending" | "processing" | "done" | "error"
  totalCount: number
  processedCount: number
  zipStorageUrl: string  // Available when status = "done"
  errorMessage: string   // Available when status = "error"
  createdAt: timestamp
  expiresAt: timestamp   // ZIP file is deleted after 24h
}
```

---

## 8. Epics, Stories, and Tasks

---

### EPIC 1 — Project Setup and Infrastructure

**Goal**: Establish the foundational project structure, CI/CD, and cloud environment so all subsequent development can proceed smoothly.

---

**Story 1.1 — Initialize Angular frontend project**
> As a developer, I need a clean Angular project scaffold with routing, i18n, and a consistent folder structure so the team can start building features.

Tasks:
- [ ] Create Angular project with Angular CLI using latest stable version
- [ ] Configure folder structure: `core/`, `features/`, `shared/`, `environments/`
- [ ] Set up Angular Router with lazy-loaded feature modules
- [ ] Configure Angular i18n with Ukrainian (default locale) and English
- [ ] Add Angular Material or a chosen UI component library
- [ ] Set up ESLint + Prettier for code style
- [ ] Create environment files for `development` and `production`

---

**Story 1.2 — Initialize backend Cloud Functions project**
> As a developer, I need a Node.js/Express project that can be deployed as GCP Cloud Functions (2nd gen) so backend logic is serverless and scalable.

Tasks:
- [ ] Create a Node.js 20 project inside a `functions/` folder
- [ ] Set up Express.js as the HTTP handler
- [ ] Configure TypeScript for the backend (tsconfig, build scripts)
- [ ] Set up ESLint + Prettier for backend code style
- [ ] Configure local development using Firebase Emulator Suite (Functions + Firestore + Storage)
- [ ] Write a simple health-check endpoint `GET /health` and verify it runs locally

---

**Story 1.3 — Configure GCP project and Firebase**
> As a developer, I need a properly configured GCP and Firebase project with all required services enabled so the app has a real cloud environment to deploy to.

Tasks:
- [ ] Create a GCP project
- [ ] Enable Firebase on the GCP project
- [ ] Enable Firestore in Native mode (region: europe-west)
- [ ] Enable Cloud Storage and create a bucket for templates and ZIP files
- [ ] Enable Cloud Functions (2nd gen)
- [ ] Enable Firebase Hosting for the Angular frontend
- [ ] Configure IAM roles: Cloud Functions service account needs Storage and Firestore access
- [ ] Add Firestore security rules: users can only read/write their own data
- [ ] Add Cloud Storage security rules: private access (backend only writes, signed URLs for download)

---

**Story 1.4 — Configure CI/CD pipeline**
> As a developer, I need automated build and deployment pipelines so that code merged to main is automatically deployed.

Tasks:
- [ ] Set up a GitHub repository with branch protection on `main`
- [ ] Create a GitHub Actions workflow to: lint, run unit tests, and build the Angular app on every pull request
- [ ] Create a GitHub Actions workflow to deploy Angular to Firebase Hosting on merge to `main`
- [ ] Create a GitHub Actions workflow to deploy Cloud Functions on merge to `main`
- [ ] Store GCP service account key and Firebase config as GitHub Secrets

---

### EPIC 2 — Authentication

**Goal**: Allow organizers to sign in with their Google account so their projects are saved and tied to their identity.

---

**Story 2.1 — Firebase Google OAuth sign-in**
> As an organizer, I want to sign in with my Google account so that my projects are saved and accessible across sessions.

Tasks:
- [ ] Install and configure AngularFire (Firebase SDK for Angular)
- [ ] Implement `AuthService` with methods: `signInWithGoogle()`, `signOut()`, `getCurrentUser()`, `isAuthenticated$()`
- [ ] Implement Google OAuth popup sign-in flow using Firebase Authentication
- [ ] Persist auth state across page refreshes using Firebase's built-in persistence
- [ ] Create a `LoginPage` component with a "Sign in with Google" button
- [ ] Display user's name and avatar in the top navigation bar when signed in
- [ ] Implement `AuthGuard` to protect all routes except the login page

---

**Story 2.2 — User profile creation on first sign-in**
> As the system, I need to create a Firestore user document when a new user signs in for the first time so that user metadata is available for future use.

Tasks:
- [ ] Implement a Firebase Auth onUserCreate trigger (Cloud Function) that creates a `User` document in Firestore when a new user registers
- [ ] Store `uid`, `email`, `displayName`, `photoURL`, `createdAt`
- [ ] Handle the case where the user document already exists (idempotent)

---

**Story 2.3 — Sign-out flow**
> As an organizer, I want to be able to sign out so that my account is not accessible from a shared device.

Tasks:
- [ ] Implement a "Sign out" button in the navigation bar
- [ ] Call `AuthService.signOut()` and redirect to the login page
- [ ] Clear all local session state on sign-out

---

### EPIC 3 — Project Management

**Goal**: Allow organizers to create, name, list, and delete diploma projects so they can manage multiple events.

---

**Story 3.1 — Project list page**
> As an organizer, I want to see a list of all my saved projects so I can continue working on an existing one or create a new one.

Tasks:
- [ ] Create a `ProjectListPage` component as the home page (post-login)
- [ ] Implement `ProjectService` with method `getUserProjects(userId)` that queries Firestore
- [ ] Display projects as cards showing: project name, creation date, last updated date
- [ ] Show an empty state with a prompt to create the first project
- [ ] Add a "New Project" button

---

**Story 3.2 — Create a new project**
> As an organizer, I want to create a new project with a name so I can start setting up a diploma generation session.

Tasks:
- [ ] Show a "Create Project" dialog/modal with a text input for project name
- [ ] Validate: name must be non-empty, max 100 characters
- [ ] On confirm, create a new `Project` document in Firestore with status `draft`
- [ ] Navigate to the project's workspace page on successful creation

---

**Story 3.3 — Delete a project**
> As an organizer, I want to delete a project I no longer need so my project list stays clean.

Tasks:
- [ ] Add a "Delete" action on each project card (requires confirmation dialog)
- [ ] On confirm, delete the Firestore `Project` document
- [ ] Delete the associated template file from Cloud Storage (call a Cloud Function to avoid direct storage access from the client)
- [ ] Remove the project from the list in the UI immediately (optimistic update)

---

**Story 3.4 — Rename a project**
> As an organizer, I want to rename a project after creating it in case I mistyped the name.

Tasks:
- [ ] Add an "Edit name" action on each project card
- [ ] Inline edit or modal with current name pre-filled
- [ ] Update `Project.name` and `Project.updatedAt` in Firestore on save

---

### EPIC 4 — Template Upload

**Goal**: Allow the organizer to upload a diploma template file so it can be used as the visual background in the editor.

---

**Story 4.1 — Upload template file**
> As an organizer, I want to upload a PDF, JPEG, or PNG diploma template so that I can visually place data fields on it.

Tasks:
- [ ] Create a `TemplateUploadComponent` with a file input (drag-and-drop + click to select)
- [ ] Validate file type: allow only `.pdf`, `.jpg`, `.jpeg`, `.png`
- [ ] Validate file size: maximum 20 MB
- [ ] Show upload progress bar while the file is being uploaded
- [ ] Upload file to Cloud Storage via a signed upload URL (Cloud Function generates the URL, Angular uploads directly to GCS to avoid routing large files through the function)
- [ ] After upload, call a Cloud Function endpoint `POST /projects/:id/template` with the GCS object path
- [ ] The Cloud Function resolves the template dimensions (width/height in pixels):
  - For JPEG/PNG: use `sharp` to get image dimensions
  - For PDF: use `pdf-lib` to read the first page dimensions and render a preview image
- [ ] Save `template` metadata (storageUrl, mimeType, widthPx, heightPx) to the Firestore Project document
- [ ] Display a thumbnail preview of the uploaded template in the UI

---

**Story 4.2 — Replace an existing template**
> As an organizer, I want to replace the template with a new file in case I uploaded the wrong one.

Tasks:
- [ ] Show a "Replace template" button on the project workspace if a template is already uploaded
- [ ] Warn the user that replacing the template will reset all field positions (confirmation dialog)
- [ ] On confirm: upload new template, delete old template from GCS, reset `Project.fields` to empty array, update Firestore

---

### EPIC 5 — Excel Upload and Column Mapping

**Goal**: Allow the organizer to upload participant data and map Excel columns to diploma fields so the system knows what data belongs where.

---

**Story 5.1 — Upload Excel file**
> As an organizer, I want to upload an Excel file with participant data so the system can read participant names and other information.

Tasks:
- [ ] Create an `ExcelUploadComponent` with a file input
- [ ] Validate file type: allow only `.xlsx` and `.xls`
- [ ] Validate file size: maximum 10 MB
- [ ] Upload the Excel file to a Cloud Function endpoint `POST /projects/:id/excel`
- [ ] The Cloud Function uses SheetJS (`xlsx` library) to parse the first sheet of the file
- [ ] Extract column headers from the first row
- [ ] Extract all data rows into an array of objects keyed by header name
- [ ] Save the extracted column headers list to `Project.excelColumns` in Firestore
- [ ] Store the raw parsed data rows temporarily in Cloud Storage as a JSON file (referenced by the project) — this avoids re-uploading Excel on every generation
- [ ] Return a preview of the first 5 rows to the frontend for user verification
- [ ] Display the preview table in the UI so the organizer can verify the data was read correctly

---

**Story 5.2 — Define diploma fields**
> As an organizer, I want to define what fields my diploma has (e.g. "First Name", "Last Name", "Place") so I can map them to Excel columns and later position them on the template.

Tasks:
- [ ] Show a "Manage Fields" panel on the project workspace
- [ ] Provide a default set of common fields: First Name, Last Name, Patronymic, Place, Date, Diploma Number
- [ ] Allow the organizer to add custom fields with a free-text label
- [ ] Allow the organizer to remove fields they don't need
- [ ] Save the list of defined fields to `Project.fields` (without position/style yet — those are set in the editor)

---

**Story 5.3 — Map Excel columns to diploma fields**
> As an organizer, I want to match each diploma field to the corresponding column in my Excel file so the system knows which data to put in each field.

Tasks:
- [ ] Show a column-mapping UI: a table where each row is a diploma field, and each row has a dropdown listing available Excel column headers
- [ ] Pre-fill obvious matches automatically where column names match field names (case-insensitive, fuzzy match)
- [ ] Validate that at least one field is mapped before allowing the user to proceed
- [ ] Allow a field to be set to "Static value" — instead of pulling from Excel, the user types a fixed text (useful for event name, date that is the same for all participants)
- [ ] Save the mapping to each `Field.excelColumn` in the Firestore Project

---

### EPIC 6 — Visual Field Placement Editor

**Goal**: Provide an interactive canvas editor where the organizer can visually place and style text fields on top of the diploma template.

---

**Story 6.1 — Display template on canvas**
> As an organizer, I want to see my diploma template displayed on screen as a canvas background so I can position fields on top of it.

Tasks:
- [ ] Create an `EditorPageComponent` using Fabric.js for canvas management
- [ ] Load the template image from Cloud Storage (using a signed URL) and render it as the canvas background
- [ ] Scale the template to fit the editor viewport while maintaining aspect ratio
- [ ] Store the scale factor to convert between canvas coordinates and actual template coordinates (editor works in display pixels; stored coordinates are in template pixels)
- [ ] Add zoom in/out controls and a "Fit to screen" button
- [ ] Disable editing the background image (it is not selectable or movable)

---

**Story 6.2 — Add and position field labels on canvas**
> As an organizer, I want to drag field labels onto the diploma canvas and position them where the text should appear so each participant's data is placed correctly on their diploma.

Tasks:
- [ ] Show a left sidebar listing all defined diploma fields that have not yet been placed
- [ ] Allow the user to drag a field from the sidebar and drop it onto the canvas (using Fabric.js text objects)
- [ ] Each field rendered on canvas shows the field label as a placeholder text (e.g. "{First Name}")
- [ ] The placed text object is movable (drag to reposition) and selectable
- [ ] Double-click on a placed field to open the style panel
- [ ] When a field is moved, update its `Field.position` (x, y) in the component state
- [ ] Show a "Remove" button/icon on selected field to remove it from the canvas (puts it back in the sidebar)
- [ ] Show coordinates (x, y) in the sidebar for the currently selected field (in template pixels)
- [ ] Auto-save field positions to Firestore on every change (debounced, 1-second delay)

---

**Story 6.3 — Style individual fields**
> As an organizer, I want to configure the font, size, color, and weight of each field individually so the diploma text looks exactly as intended.

Tasks:
- [ ] Show a style panel (right sidebar or popover) when a field is selected on the canvas
- [ ] Style controls:
  - Font family: dropdown with a curated list of fonts (Arial, Times New Roman, Georgia, Roboto, Open Sans, and at least one Cyrillic-compatible font such as PT Serif)
  - Font size: number input (range 6–120 pt)
  - Color: color picker (hex input + visual picker)
  - Bold: toggle button
  - Italic: toggle button
  - Alignment: left / center / right (segmented control)
- [ ] Apply font changes live on the canvas (Fabric.js text object re-renders immediately)
- [ ] For web fonts (Roboto, Open Sans), load fonts via Google Fonts in the Angular app
- [ ] Auto-save style changes to Firestore (debounced)

---

**Story 6.4 — Preview diploma with real data**
> As an organizer, I want to preview how the diploma will look for a specific participant before generating all diplomas so I can verify the position and styling are correct.

Tasks:
- [ ] Add a "Preview" button in the editor toolbar
- [ ] Show a row selector: dropdown or arrows to pick which Excel row to preview (default: first row)
- [ ] Call Cloud Function `POST /projects/:id/preview` with current field config and selected row index
- [ ] The Cloud Function generates a single preview PDF and returns a signed URL for the preview image (render first page as PNG for display)
- [ ] Display the rendered preview in a modal overlay
- [ ] Show a loading state while the preview is being generated

---

### EPIC 7 — Batch PDF Generation and Download

**Goal**: Generate individual PDF diplomas for all participants and let the organizer download them as a ZIP archive.

---

**Story 7.1 — Trigger batch generation**
> As an organizer, I want to trigger the generation of all diplomas with a single button click so I don't have to generate them one by one.

Tasks:
- [ ] Add a "Generate All Diplomas" button on the project workspace (visible after template, Excel, and at least one field are configured)
- [ ] Show a confirmation dialog with: participant count, estimated time, note that an existing ZIP will be replaced
- [ ] On confirm, call Cloud Function `POST /projects/:id/generate`
- [ ] The Cloud Function creates a `GenerationJob` document in Firestore with `status: "pending"` and returns immediately (job ID is returned in response — generation happens asynchronously)
- [ ] Display a progress indicator in the UI while the job is running

---

**Story 7.2 — Backend batch PDF generation**
> As the system, I need to generate one PDF diploma per Excel row by combining the template with positioned and styled text fields so each participant receives a personalized diploma.

Tasks:
- [ ] Implement the `generateDiplomas` Cloud Function that:
  - Reads the `Project` document (template metadata, fields, styles, positions)
  - Reads the participant data JSON from Cloud Storage
  - For each row:
    - Load the template (PDF or rasterized image)
    - If template is PDF: use `pdf-lib` to load the PDF and draw text at configured positions
    - If template is JPEG/PNG: use `pdf-lib` to create a new PDF page, embed the image, then draw text on top
    - Apply position (scaled from template pixels), font, size, color, bold, italic, alignment
    - Save the single PDF to a temporary buffer
  - Bundle all individual PDFs into a ZIP using `archiver`
  - Upload the ZIP to Cloud Storage with a path like `zips/{projectId}/{jobId}.zip`
  - Update `GenerationJob.status = "done"` and set `zipStorageUrl`
- [ ] Handle errors: if any diploma fails, mark `GenerationJob.status = "error"` with error details
- [ ] Update `GenerationJob.processedCount` periodically during processing so the frontend can show progress
- [ ] Set ZIP file to expire after 24 hours (Cloud Storage object lifecycle rule)

---

**Story 7.3 — Real-time generation progress**
> As an organizer, I want to see the generation progress in real-time so I know how many diplomas have been processed.

Tasks:
- [ ] Subscribe to the `GenerationJob` Firestore document using AngularFire real-time listener
- [ ] Display a progress bar: `processedCount / totalCount`
- [ ] When `status = "done"`, show a success message and a "Download ZIP" button
- [ ] When `status = "error"`, show an error message with details and a "Retry" button

---

**Story 7.4 — Download ZIP archive**
> As an organizer, I want to download a ZIP file containing all generated diplomas so I can distribute them to participants.

Tasks:
- [ ] Call Cloud Function `GET /projects/:id/jobs/:jobId/download` to get a short-lived signed URL for the ZIP file in Cloud Storage
- [ ] Trigger the browser download using the signed URL
- [ ] Name the ZIP file descriptively: `{ProjectName}_diplomas.zip`
- [ ] Show file size in the download button label
- [ ] If the ZIP has expired (24h), show a prompt to re-generate

---

### EPIC 8 — Multilingual UI

**Goal**: Support both Ukrainian (default) and English languages across all UI text.

---

**Story 8.1 — Set up Angular i18n**
> As a developer, I need Angular i18n configured so UI strings can be maintained in multiple languages.

Tasks:
- [ ] Configure Angular i18n with `uk` (Ukrainian) as the default/base locale and `en` as the second locale
- [ ] Mark all static UI strings in templates with `i18n` attributes
- [ ] Mark dynamic strings in TypeScript code using `$localize` tagged template literal
- [ ] Extract messages to `messages.xlf` (source file)
- [ ] Create `messages.en.xlf` with English translations for all strings
- [ ] Configure Angular build to produce separate bundles per locale
- [ ] Serve the correct locale based on the URL prefix: `/uk/...` and `/en/...`; default redirect to `/uk/`

---

**Story 8.2 — Language switcher**
> As an organizer, I want to switch the UI language between Ukrainian and English so I can use the app in my preferred language.

Tasks:
- [ ] Add a language switcher (flag icon + language name) in the top navigation bar
- [ ] Switching language navigates to the equivalent page in the selected locale (`/uk/` ↔ `/en/`)
- [ ] Remember the user's language preference in `localStorage` and apply it on next visit
- [ ] Ensure all pages, dialogs, and error messages are fully translated in both languages

---

### EPIC 9 — UX Polish and Error Handling

**Goal**: Ensure the application is reliable, user-friendly, and provides clear feedback at every step.

---

**Story 9.1 — Global error handling**
> As an organizer, I want to see clear error messages when something goes wrong so I know what happened and what to do next.

Tasks:
- [ ] Implement a global Angular HTTP interceptor that catches 4xx and 5xx errors
- [ ] Show a toast/snackbar notification for transient errors (network errors, server errors)
- [ ] For critical errors (e.g., generation failure), show an inline error with a retry button
- [ ] Log all errors to the browser console in development mode
- [ ] Integrate Cloud Logging on the backend (Cloud Functions automatically logs to Cloud Logging)

---

**Story 9.2 — Loading states and empty states**
> As an organizer, I want to see loading indicators and helpful empty states so the app feels responsive and I always know what to do next.

Tasks:
- [ ] Add skeleton screens or spinner for: project list loading, template loading in editor, Excel preview loading
- [ ] Add helpful empty states with clear call-to-action for: empty project list, no template uploaded, no Excel uploaded, no fields placed
- [ ] Disable the "Generate All" button and show a tooltip explaining what is missing if prerequisites (template, Excel, ≥1 field) are not met

---

**Story 9.3 — Responsive layout and basic accessibility**
> As a developer, I need the app to be usable on common desktop screen sizes and meet basic accessibility standards.

Tasks:
- [ ] Ensure layout works correctly at 1280×720, 1440×900, and 1920×1080 resolutions (the canvas editor is desktop-only)
- [ ] Add ARIA labels to interactive elements: buttons, form fields, dialogs
- [ ] Ensure all interactive elements are keyboard-accessible (Tab, Enter, Escape)
- [ ] Ensure color contrast meets WCAG AA standard (4.5:1 ratio for text)
- [ ] Test with screen reader (NVDA or built-in browser reader) for the main flow

---

## 9. Out of Scope (Future Releases)

The following features are explicitly deferred and should not be implemented in the MVP:

| Feature | Target Release |
|---|---|
| Google Drive export of generated diplomas | v1.1 |
| Email delivery of diplomas to participants | v1.2 |
| Multiple pages / page selection for PDF templates | v1.1 |
| Custom font upload by the organizer | v1.2 |
| Team collaboration / shared projects | v2.0 |
| Diploma statistics / audit log (who downloaded, when) | v2.0 |
| Subscription billing | v2.0 |
| Mobile layout for the editor | v2.0 |
| QR code field type (verification QR on diploma) | v1.2 |
| Diploma verification portal (public URL to verify diploma authenticity) | v2.0 |

---

*End of documentation.*
