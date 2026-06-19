# FraudCase GH - Evidentiary System Security & Architecture Guidelines

This document outlines the security, privacy, and architectural guidelines implemented in the MVP of **FraudCase GH**, along with detailed roadmaps for future production development in VS Code.

---

## 🔒 1. Privacy, Local Pre-Filtering, & Redaction Layer

To maintain a secure, privacy-preserving telemetry lifecycle for Ghanaian freelance operators, students, and SMEs:
- **Local PII Redaction:** Standard PII data (phone numbers, emails, credit card patterns, and local Ghana Card patterns like `GHA-XXXXXXXXX-X`) is pre-filtered and replaced on the client computer before sending to any server-side AI endpoints.
- **Data Minimization:** No transactional keys or authentic credentials (such as Mobile Money PINs or passwords) should ever be entered into the system.
- **Watermark & Certified Stamps:** Exported dossiers contain automated integrity stamps to maintain structured accountability when presenting compiled files to financial providers or the National Cybersecurity Authority (NCA).

---

## 🛠️ 2. Production Scalability & Migration Roadmap (VS Code / GitHub)

FraudCase GH is designed as a standalone, modular full-stack application. To scale this MVP to enterprise-grade operations, follow these TODO guidelines in your local editor:

### TODO 2.1: Firebase Authentication Integration
In `src/components/AppShell.tsx` and `server.ts`:
- Integrate Google/Email login using the Firebase Auth Client SDK on the frontend.
- Verify JWT tokens on the server using `firebase-admin` middleware before releasing private incident records.

### TODO 2.2: Firestore Database Migration
In `server.ts`:
- Replace the in-memory array (`databaseCases`) with Firestore collections.
- Model the database structure:
  ```
  /users
    /{userId}
      /cases
        /{caseId}
          /evidenceItems
            /{evidenceId}
  ```
- Implement secure Firestore Security Rules inside `firestore.rules` to prevent unauthorized cross-user reads.

### TODO 2.3: Cloud Storage for Physical Screen Captures
In `src/components/EvidenceInput.tsx`:
- Swap the simulated mock file picker with Firebase Cloud Storage upload API.
- Store original screenshots under `/users/{uid}/cases/{caseId}/evidence/{fileId}` with short-lived authenticated read URLs.

### TODO 2.4: App Check Protection
In `server.ts` and `src/main.tsx`:
- Activate Firebase App Check with custom Play Integrity or reCAPTCHA Enterprise providers.
- Safeguard the `/api/cases/:id/analyze` endpoint from automated API scraping and resource depletion.

### TODO 2.5: High-Fidelity Client-Side PDF Compilation
In `src/components/ReportPreview.tsx`:
- Transition the `window.print()` trigger to modern high-fidelity compilation libraries such as `jspdf` or `@react-pdf/renderer` to generate custom, downloadable encrypted PDF reports directly.

---

## 🚀 3. Deployment Configuration (Google Cloud Run)

To serve the production build on Google Cloud Run:
1. **Container Build Script:** Modify `package.json` and build the Docker image using the default `Dockerfile`:
   ```dockerfile
   FROM node:20-slim
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --omit=dev
   COPY . .
   RUN npm run build
   ENV NODE_ENV=production
   EXPOSE 3000
   CMD ["npm", "start"]
   ```
2. **Environment Secret Injection:** Guard the `GEMINI_API_KEY` by mounting it directly from Google Secret Manager into Cloud Run container environment values.
