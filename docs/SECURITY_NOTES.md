# Security, Privacy & Isolation Architecture

This document outlines the security architecture implemented in the FraudCase GH evidentiary helper, highlighting how user data is protected, isolated, and queried under solid compliance standards.

## 1. Authentication Model
We use **Firebase Authentication** as the provider-of-record for managing workspace key access:
* **Protocol**: Sign-ups and sign-ins use secure client-side password credential bindings directly interfacing with Firebase Auth service.
* **Credentials**: Raw user passwords are encrypted, salted, and processed server-side by Google authentication node systems. They are never captured or readable by our custom application.
* **Session Lifecycles**: Clients obtain signed JSON Web Tokens (ID Tokens) which persist securely in the browser state and auto-refresh.

## 2. Server-Controlled User Isolation
We implement **Row-Level User Separation** on our backend database:
* Every document registered in the Firestore database includes an `ownerId` metadata field mapping explicitly to the investigator's validated Firebase Auth UID.
* No shared memory is created. A standard user's dashboard only retrieves cases they initiated themselves:
  ```json
  where("ownerId", "==", req.user.uid)
  ```
* Direct client-side calls to alter or swap target `ownerIds` on existing dossiers will fail because the `ownerId` is non-updatable.

## 3. API ID Token Verification
Every interaction between the frontend client and our full-stack Express server verifies authentication state:
1. **Extraction**: The client attaches a fresh authorization header to all `/api/*` endpoints: `Authorization: Bearer <ID_TOKEN>`.
2. **Validation**: The Express server uses the `firebase-admin` SDK node-side to decode and verify the cryptographically signed token.
3. **Session Anchoring**: The `ownerId` is retrieved directly from the verified token payload. Client-supplied identifier parameters inside requested JSON payloads are completely ignored for authorization purposes.

## 4. Privacy Guidelines for Sensitive Scams
Because digital scam transcripts often include sensitive phone numbers, wallet numbers, and message bodies:
* **No Public Indices**: Absolute containment is enforced. There are no public landing indices, open search results, or links readable by non-authenticated users.
* **Guilt Disclaimer**: Findings compiled inside the AI organizer and exported reports are strictly decision-support aids designed for legal/cybersecurity teams. No public shaming or vigilante open-network dox lists are supported or permitted.
* **Clean Data hygiene**: Users are continuously warned at input to filter out highly sensitive credentials like PINs, master account passkeys, or bank authorization codes.

## 5. Future Storage Enhancements
* **Cloud Storage for Files**: Future phases will implement secure Firebase Cloud Storage buckets for case files, using Signed URLs to restrict access exclusively to verified owners.
* **Automatic Redaction Hooks**: Future endpoints will parse incoming evidence to auto-censor highly critical indicators (like financial CVVs or complete bank account numbers) prior to analysis.
