# DiplomaGen — Technical Specification

> Version: 1.0  
> Date: March 7, 2026  
> Supplements: PROJECT_DOCUMENTATION.md  

This document covers four technical decisions that must be agreed upon before development starts. All AI agents and developers working on this project must treat this file as the source of truth for these topics.

---

## Table of Contents

1. [REST API Specification](#1-rest-api-specification)
2. [Firestore Collection Structure](#2-firestore-collection-structure)
3. [Font Embedding Strategy for PDF Generation](#3-font-embedding-strategy-for-pdf-generation)
4. [Coordinate System: Canvas Editor ↔ PDF Generation](#4-coordinate-system-canvas-editor--pdf-generation)

---

## 1. REST API Specification

All Cloud Function endpoints are served under a single Express app deployed as one Cloud Function named `api`. The base URL in production is:

```
https://{region}-{project-id}.cloudfunctions.net/api
```

In local development (Firebase Emulator):

```
http://localhost:5001/{project-id}/{region}/api
```

### Authentication

Every request (except `GET /health`) must include a Firebase ID token in the Authorization header:

```
Authorization: Bearer {firebaseIdToken}
```

The backend verifies this token using the Firebase Admin SDK on every request via an Express middleware called `authenticate`. If the token is missing or invalid, the middleware returns:

```json
HTTP 401
{
  "error": "UNAUTHENTICATED",
  "message": "Missing or invalid Firebase ID token."
}
```

### Standard Error Response Shape

All error responses follow this structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description."
}
```

Common error codes:

| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | User does not own this resource |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Request body failed validation |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

### Endpoints

---

#### `GET /health`

Health check. No authentication required.

**Response `200`:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-07T12:00:00.000Z"
}
```

---

#### `POST /projects`

Create a new project.

**Request body:**
```json
{
  "name": "Regional Math Olympiad 2026"
}
```

**Validation:**
- `name`: required, string, 1–100 characters.

**Response `201`:**
```json
{
  "id": "abc123",
  "name": "Regional Math Olympiad 2026",
  "ownerId": "uid_of_user",
  "createdAt": "2026-03-07T12:00:00.000Z",
  "updatedAt": "2026-03-07T12:00:00.000Z",
  "template": null,
  "excelColumns": [],
  "excelDataPath": null,
  "totalRows": null,
  "columnMaxValues": null,
  "fields": []
}
```

---

#### `GET /projects`

Get all projects belonging to the authenticated user.

**Response `200`:**
```json
{
  "projects": [
    {
      "id": "abc123",
      "name": "Regional Math Olympiad 2026",
      "createdAt": "2026-03-07T12:00:00.000Z",
      "updatedAt": "2026-03-07T12:00:00.000Z",
      "template": {
        "mimeType": "image/jpeg",
        "widthPx": 2480,
        "heightPx": 3508
      }
    }
  ]
}
```

> Note: `template.storageUrl` is intentionally excluded from list responses for security. It is only returned by single-project endpoints and via signed URL endpoints.

---

#### `GET /projects/:projectId`

Get full details of a single project.

**Response `200`:**
```json
{
  "id": "abc123",
  "name": "Regional Math Olympiad 2026",
  "ownerId": "uid_of_user",
  "createdAt": "2026-03-07T12:00:00.000Z",
  "updatedAt": "2026-03-07T12:00:00.000Z",
  "template": {
    "mimeType": "image/jpeg",
    "widthPx": 2480,
    "heightPx": 3508
  },
  "excelColumns": ["Прізвище", "Ім'я", "По батькові", "Місце"],
  "fields": [
    {
      "id": "field_1",
      "label": "Last Name",
      "excelColumn": "Прізвище",
      "staticValue": null,
      "position": { "x": 1240, "y": 800 },
      "style": {
        "fontFamily": "PTSerif",
        "fontSize": 48,
        "color": "#1A1A1A",
        "bold": true,
        "italic": false,
        "align": "center"
      }
    }
  ]
}
```

---

#### `PATCH /projects/:projectId`

Update project name.

**Request body:**
```json
{
  "name": "New Project Name"
}
```

**Response `200`:** returns full project object (same shape as `GET /projects/:projectId`).

---

#### `DELETE /projects/:projectId`

Delete a project and all associated files from Cloud Storage.

**Response `204`:** empty body.

---

#### `POST /projects/:projectId/upload-url`

Request a signed upload URL so the Angular client can upload the template file directly to Cloud Storage (no file bytes pass through the Cloud Function).

**Request body:**
```json
{
  "mimeType": "application/pdf",
  "extension": "pdf"
}
```

**Validation:**
- `mimeType`: must be one of `application/pdf`, `image/jpeg`, `image/png`.
- `extension`: string, max 5 characters.

**Response `200`:**
```json
{
  "uploadUrl": "https://storage.googleapis.com/...",
  "gcsPath": "templates/uid_of_user/abc123/template.pdf",
  "useDirectUpload": false
}
```

In the **Firebase Emulator**, `uploadUrl` is `null` and `useDirectUpload` is `true` — signed GCS URLs are not supported in the emulator. The Angular client falls back to `POST /projects/:projectId/upload` in that case.

When `useDirectUpload` is `false`, the client performs a `PUT` request directly to `uploadUrl` with the file bytes and `Content-Type` header.

---

#### `POST /projects/:projectId/upload` *(emulator fallback only)*

Accepts the template file as `multipart/form-data`. Used only when the Firebase Emulator cannot issue signed GCS URLs (`useDirectUpload: true` from `upload-url`).

**Request:** `Content-Type: multipart/form-data`, query param `?ext=pdf|jpg|png`
- Field name: `file`

**Response `200`:**
```json
{
  "gcsPath": "templates/uid_of_user/abc123/template.pdf",
  "mimeType": "application/pdf"
}
```

---

#### `POST /projects/:projectId/template`

Called after the file has been successfully uploaded. The Cloud Function reads the file, resolves its dimensions, and saves metadata to Firestore. Replaces any previously set template and resets all field positions.

**Request body:**
```json
{
  "gcsPath": "templates/uid_of_user/abc123/template.pdf",
  "mimeType": "application/pdf"
}
```

**Response `200`:** Returns the saved `TemplateMetadata` object directly:
```json
{
  "storageUrl": "templates/uid_of_user/abc123/template.pdf",
  "mimeType": "application/pdf",
  "widthPx": 2480,
  "heightPx": 3508
}
```

> PDF page dimensions are converted to pixels at 96 DPI (1 pt = 96/72 px). For JPEG/PNG the native pixel dimensions are used.

---

#### `GET /projects/:projectId/template/signed-url`

Returns a short-lived signed URL for presigned read access to the template file.

**Response `200`:**
```json
{
  "signedUrl": "https://storage.googleapis.com/...",
  "expiresAt": "2026-03-07T13:00:00.000Z"
}
```

---

#### `GET /projects/:projectId/template/content`

Proxies the raw template file bytes through the authenticated Cloud Function. Works in both the emulator and production without requiring a separate Storage request. Response `Content-Type` matches the template MIME type.

---

#### `POST /projects/:projectId/excel`

Upload and parse an Excel file. The Angular client sends the file as `multipart/form-data`.

**Request:** `Content-Type: multipart/form-data`
- Field name: `file`
- File: `.xlsx` or `.xls`, max 10 MB.

**Response `200`:**
```json
{
  "columns": ["Прізвище", "Ім'я", "По батькові", "Місце"],
  "totalRows": 142,
  "preview": [
    { "Прізвище": "Коваленко", "Ім'я": "Олексій", "По батькові": "Миколайович", "Місце": "1" },
    { "Прізвище": "Бойко",     "Ім'я": "Марія",   "По батькові": "Іванівна",    "Місце": "2" }
  ]
}
```

> The parsed data is stored internally in Cloud Storage as a JSON file at `data/{uid}/{projectId}/participants.json`. This path is never exposed to the client.

---

#### `PATCH /projects/:projectId/fields`

Save or update the full list of fields for a project (bulk replace, not individual update). This is called by the Angular editor on every auto-save.

**Request body:**
```json
{
  "fields": [
    {
      "id": "field_1",
      "label": "Last Name",
      "excelColumn": "Прізвище",
      "staticValue": null,
      "position": { "x": 1240, "y": 800 },
      "style": {
        "fontFamily": "PTSerif",
        "fontSize": 48,
        "color": "#1A1A1A",
        "bold": true,
        "italic": false,
        "align": "center"
      }
    }
  ]
}
```

**Validation:**
- `fields`: required, array, max 20 items.
- Each field: `id`, `label` required; `position` may be `null` if the field has not yet been placed on canvas.
- `excelColumn` and `staticValue` are mutually exclusive: exactly one must be non-null (unless the field is not yet mapped).

**Response `200`:** returns updated full project object.

---

#### `POST /projects/:projectId/preview`

Generate a preview PDF for a single participant row and return a signed URL to a rendered PNG image.

**Request body:**
```json
{
  "rowIndex": 0
}
```

**Validation:**
- `rowIndex`: integer ≥ 0. Must be less than `totalRows` in the parsed data.

**Response `200`:**
```json
{
  "previewImageUrl": "https://storage.googleapis.com/...",
  "expiresAt": "2026-03-07T13:00:00.000Z"
}
```

> The signed URL expires in 1 hour. The preview PNG is stored at `previews/{uid}/{projectId}/{rowIndex}.png` and is overwritten on each call.

---

#### `POST /projects/:projectId/generate`

Trigger batch diploma generation. Returns immediately with a job ID; generation runs asynchronously.

**Request body:** empty `{}`.

**Validation:**
- Check if user has enough `availableGenerations`. If not, return `402 Payment Required`.

**Response `202`:**
```json
{
  "jobId": "job_xyz789",
  "totalCount": 142,
  "status": "pending"
}
```

---

#### `POST /users/activate-promo`

Activate a purchased promo code to increase generation balance.

**Request body:**
```json
{
  "code": "PROMO-12345"
}
```

**Response `200`:**
```json
{
  "success": true,
  "addedGenerations": 2000,
  "newBalance": 2050
}
```

---

---

#### `GET /projects/:projectId/jobs`

Get the list of recent generation jobs for a project, ordered by creation date descending (max 10).

**Response `200`:**
```json
{
  "jobs": [
    {
      "id": "job_xyz789",
      "projectId": "abc123",
      "status": "done",
      "totalCount": 142,
      "processedCount": 142,
      "zipStorageUrl": "zips/uid_of_user/abc123/job_xyz789.zip",
      "errorMessage": null,
      "createdAt": "2026-03-07T12:00:00.000Z",
      "expiresAt": "2026-03-08T12:00:00.000Z"
    }
  ]
}
```

---

#### `GET /projects/:projectId/jobs/:jobId`

Get the current status of a generation job. The Angular client also subscribes to this document in real-time via Firestore directly (using AngularFire), so this REST endpoint is only needed for initial load.

**Response `200`:**
```json
{
  "id": "job_xyz789",
  "projectId": "abc123",
  "status": "processing",
  "totalCount": 142,
  "processedCount": 67,
  "zipStorageUrl": null,
  "errorMessage": null,
  "createdAt": "2026-03-07T12:00:00.000Z",
  "expiresAt": "2026-03-08T12:00:00.000Z"
}
```

---

#### `GET /projects/:projectId/jobs/:jobId/download`

Streams the generated ZIP archive bytes directly through the authenticated Cloud Function. The client receives a binary `application/zip` response — no separate Storage URL or expiry logic required.

**Response `200`:** Binary ZIP stream.
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="diplomas_{projectId}.zip"`

**Error cases:**
- `409 JOB_NOT_DONE` — generation is still in progress.
- `410 ZIP_EXPIRED` — the 24-hour retention window has passed.
- `404 NOT_FOUND` — job does not exist or ZIP was deleted.

---

## 2. Firestore Collection Structure

### Collection paths

```
/users/{uid}
/users/{uid}/projects/{projectId}
/users/{uid}/projects/{projectId}/jobs/{jobId}
```

### Rationale for subcollections

- Projects are subcollections under the user. This enforces ownership at the database level: Firestore security rules can simply use `request.auth.uid == resource.data.ownerId` or match the path `users/{uid}/...`.
- Jobs are subcollections under the project. This makes it trivial to list all jobs for a project and to clean up when a project is deleted.
- There are no top-level `projects` or `jobs` collections. This prevents cross-user data leaks even if security rules have a bug.

### Document schemas

#### `/users/{uid}`
```
{
  uid:                  string,       // same as the document ID
  email:                string,
  displayName:          string,
  photoURL:             string,
  availableGenerations: number,       // Decremented on generation, incremented by promo codes
  createdAt:            Timestamp
}
```

#### `/users/{uid}/projects/{projectId}`
```
{
  id:          string,       // same as the document ID
  ownerId:     string,       // same as {uid} in the path
  name:        string,
  createdAt:   Timestamp,
  updatedAt:   Timestamp,

  template: null | {
    storageUrl:  string,     // GCS object path (NOT a public URL)
    mimeType:    string,
    widthPx:     number,
    heightPx:    number
  },

  excelColumns:     string[],
  excelDataPath:    string | null,   // GCS path to participants.json
  totalRows:        number | null,
  columnMaxValues:  Record<string, string> | null,   // longest value per column, for editor canvas preview

  fields: [
    {
      id:           string,
      label:        string,
      excelColumn:  string | null,
      staticValue:  string | null,
      position:     { x: number, y: number } | null,
      style: {
        fontFamily: string,
        fontSize:   number,
        color:      string,
        bold:       boolean,
        italic:     boolean,
        align:      "left" | "center" | "right"
      }
    }
  ]
}
```

#### `/users/{uid}/projects/{projectId}/jobs/{jobId}`
```
{
  id:               string,
  projectId:        string,
  status:           "pending" | "processing" | "done" | "error",
  totalCount:       number,
  processedCount:   number,
  zipStorageUrl:    string | null,
  errorMessage:     string | null,
  createdAt:        Timestamp,
  expiresAt:        Timestamp
}
```

#### `/promoCodes/{codeId}` (Top-level collection for admin/backend use)
```
{
  id:          string,       // e.g. "PROMO-12345"
  generations: number,       // e.g. 2000
  isUsed:      boolean,
  usedBy:      string | null,
  usedAt:      Timestamp | null
}
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read and write their own user document
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      // Users can only read and write their own projects
      match /projects/{projectId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;

        // Users can only read their own jobs (write is backend-only)
        match /jobs/{jobId} {
          allow read: if request.auth != null && request.auth.uid == uid;
          allow write: if false; // Only the backend (Admin SDK) writes jobs
        }
      }
    }
  }
}
```

### Cloud Storage Structure

```
/templates/{uid}/{projectId}/{filename}       — original uploaded template
/templates/{uid}/{projectId}/preview.jpg      — preview JPEG of template (for editor)
/data/{uid}/{projectId}/participants.json     — parsed Excel data
/previews/{uid}/{projectId}/{rowIndex}.png    — single-row preview render
/zips/{uid}/{projectId}/{jobId}.zip              — generated diploma ZIP
```

**Lifecycle rules (set in GCS bucket settings):**
- Objects under `zips/` are deleted after **24 hours**.
- Objects under `previews/` are deleted after **1 hour**.
- Objects under `data/`, `templates/` persist until the project is deleted.

---

## 3. Font Embedding Strategy for PDF Generation

### The Problem

`pdf-lib` does not use system fonts. It cannot reference "Arial" or "Roboto" by name. To draw any text on a PDF, `pdf-lib` requires the full binary font file (`.ttf` or `.otf`) to be loaded into memory and embedded into the PDF document.

For Cyrillic text, this is especially important: the built-in PDF standard fonts (Helvetica, Times-Roman, Courier) do not include Cyrillic characters and will render them as blank squares.

### Solution: Bundle Fonts with the Cloud Function

A curated set of fonts is downloaded once and stored in the Cloud Function's deployment package (inside the `functions/assets/fonts/` folder). These fonts are bundled at deploy time and available in the Cloud Function's file system at runtime.

### Selected Font Set

The following fonts are bundled. All are open-source and support the full Latin + Cyrillic Unicode range required for Ukrainian text:

| Font Family Name (in UI) | Files Bundled | Source |
|---|---|---|
| `PTSerif` | `PTSerif-Regular.ttf`, `PTSerif-Bold.ttf`, `PTSerif-Italic.ttf`, `PTSerif-BoldItalic.ttf` | Google Fonts |
| `PTSans` | `PTSans-Regular.ttf`, `PTSans-Bold.ttf`, `PTSans-Italic.ttf`, `PTSans-BoldItalic.ttf` | Google Fonts |
| `Roboto` | `Roboto-Regular.ttf`, `Roboto-Bold.ttf`, `Roboto-Italic.ttf`, `Roboto-BoldItalic.ttf` | Google Fonts |
| `OpenSans` | `OpenSans-Regular.ttf`, `OpenSans-Bold.ttf`, `OpenSans-Italic.ttf`, `OpenSans-BoldItalic.ttf` | Google Fonts |
| `TimesNewRoman` | `times.ttf`, `timesbd.ttf`, `timesi.ttf`, `timesbi.ttf` | Bundled (licensed for redistribution) |

> **Note:** Arial is excluded because it is a Microsoft font and cannot be legally redistributed. PT Serif and PT Sans are suitable drop-in alternatives for formal diplomas with full Cyrillic support.

### Font Resolution Logic (Backend)

When the Cloud Function needs to draw a field, it resolves the font file path as follows:

```
fontFamily: "PTSerif"
bold: true
italic: false

→ loads: functions/assets/fonts/PTSerif/PTSerif-Bold.ttf
```

Resolution table:

| bold | italic | File suffix |
|---|---|---|
| false | false | `-Regular.ttf` |
| true | false | `-Bold.ttf` |
| false | true | `-Italic.ttf` |
| true | true | `-BoldItalic.ttf` |

The font bytes are read with `fs.readFileSync()` and embedded into the PDF using `pdf-lib`'s `embedFont()` method:

```javascript
const fontBytes = fs.readFileSync(resolvedFontPath);
const font = await pdfDoc.embedFont(fontBytes);
```

Each unique font variant used in a project is embedded once per PDF document, not once per field.

### Angular Font Preview (Frontend)

The Angular canvas editor uses web fonts (loaded from Google Fonts) to display a live preview in the canvas. The font names in the dropdown must match exactly:

| UI dropdown label | CSS / Google Fonts name | pdf-lib bundle key |
|---|---|---|
| PT Serif | `'PT Serif'` | `PTSerif` |
| PT Sans | `'PT Sans'` | `PTSans` |
| Roboto | `'Roboto'` | `Roboto` |
| Open Sans | `'Open Sans'` | `OpenSans` |
| Times New Roman | `'Times New Roman'` | `TimesNewRoman` |

The `Field.style.fontFamily` stored in Firestore uses the **pdf-lib bundle key** (right column). The Angular frontend maps this key to the Google Fonts CSS name for rendering in Fabric.js.

> The canvas preview and the generated PDF will look visually identical because both use the same font design, even though one uses a web font and the other uses a bundled `.ttf` file.

---

## 4. Coordinate System: Canvas Editor ↔ PDF Generation

### The Problem

There are three different coordinate systems in play, and they must be converted correctly or all text will be misplaced on the generated PDFs:

1. **Canvas display coordinates** — pixels on screen in the Angular editor (depends on the user's screen size and zoom level).
2. **Template pixel coordinates** — the "real" size of the template image in pixels (e.g. 2480 × 3508 for A4 at 300 DPI).
3. **PDF point coordinates** — pdf-lib uses points (pt) with the origin at the **bottom-left** corner of the page.

### Step 1: Canvas display → Template pixel coordinates

The Angular editor scales the template to fit the viewport. A scale factor is computed when the template is loaded:

```
scaleFactor = canvasDisplayWidth / template.widthPx
```

When a field is dragged to a position `(canvasX, canvasY)` in the editor, the stored position is immediately converted to template pixels:

```
storedX = canvasX / scaleFactor
storedY = canvasY / scaleFactor
```

**Only template pixel coordinates are stored in Firestore.** Canvas display coordinates are never persisted. This ensures that the stored positions are resolution-independent and work correctly when the project is reopened on a different screen.

### Step 2: Template pixel coordinates → PDF point coordinates

PDF pages use a coordinate system where:
- The origin `(0, 0)` is at the **bottom-left** corner of the page.
- Coordinates are measured in **points** (1 pt = 1/72 inch).
- Y increases **upward**.

Template image pixels use:
- The origin `(0, 0)` at the **top-left** corner.
- Y increases **downward**.

The conversion performed by the Cloud Function during PDF generation:

```
// 1. Convert template pixels to PDF points
//    (template DPI is known from template dimensions vs standard paper size,
//     but we always derive it from the template itself)

templateDPI = template.widthPx / pageWidthInInches
//  e.g. 2480px / 8.27in = ~299.9 DPI ≈ 300 DPI

pdfX_pt = (storedX / templateDPI) * 72
pdfY_pt = pageHeight_pt - ((storedY / templateDPI) * 72)

// 2. pdfY_pt is the Y coordinate of the TEXT BASELINE in PDF space
//    (pdf-lib drawText places text from the baseline)
```

For JPEG/PNG templates converted to PDF by the backend, the page is created with exact dimensions matching the template:

```
pageWidth_pt  = (template.widthPx  / templateDPI) * 72
pageHeight_pt = (template.heightPx / templateDPI) * 72
```

### Step 3: Text alignment offset

When alignment is `"center"` or `"right"`, an additional X offset is applied:

```
textWidth_pt = font.widthOfTextAtSize(fieldValue, fontSize_pt)

if (align === "center") adjustedX = pdfX_pt - textWidth_pt / 2
if (align === "right")  adjustedX = pdfX_pt - textWidth_pt
if (align === "left")   adjustedX = pdfX_pt
```

> **Important for the Fabric.js editor**: In the Fabric.js canvas, the `left` property of a text object refers to the **left edge** of the text bounding box. When alignment is `center` or `right`, the text is rendered differently. The stored `position.x` always represents the **anchor point** — which is the left edge for left-aligned text, the center for center-aligned, and the right edge for right-aligned text. This matches the adjustment logic above.

### Step 4: Longest String Preview and Empty Values

- **Editor Preview:** Instead of using the static column name (e.g. "{First Name}"), the frontend editor uses the longest string from that specific column in the uploaded Excel data as the placeholder. The user aligns this longest string on the canvas. Because alignment (left/center/right) is handled automatically, shorter strings will naturally fall into the correct bounds without overflowing.
- **Empty Cells:** During backend PDF generation, if an Excel cell has no data (empty or whitespace only), the backend skips the `pdf-lib` draw operation for that field entirely. No placeholders or "undefined" strings are rendered.

### Summary Table

| | Origin | Y direction | Units | Used where |
|---|---|---|---|---|
| Canvas display | Top-left | Down | px (display) | Fabric.js rendering only |
| Template pixel | Top-left | Down | px | Stored in Firestore |
| PDF point | Bottom-left | Up | pt (1/72 inch) | pdf-lib drawing |

### DPI Inference Rule

The backend does not ask the user for the DPI of their template. Instead, it infers DPI by comparing the template's pixel dimensions to standard paper sizes:

| Template width (px) | Assumed paper | Assumed DPI |
|---|---|---|
| 2480 | A4 portrait | 300 |
| 3508 | A4 landscape (width) | 300 |
| 3307 | A3 portrait | 400 |
| 1240 | A4 portrait | 150 |
| Other | Assume 96 DPI (screen) | 96 |

If the template width does not match any known size within ±5%, the backend defaults to 96 DPI and logs a warning. The coordinate math still works correctly — the diplomas will be generated at the correct proportions, though the physical print size may differ from what the organizer expects.

> **Recommendation**: Document to the organizer (in UI tooltip) that diploma templates should be exported at 300 DPI for best print quality.

---

*End of technical specification.*
