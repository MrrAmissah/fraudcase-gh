# Cloud Run / container scaffold for FraudCase GH (staging readiness; not yet deployed).
#
# One Node process serves BOTH the built SPA and the /api routes (server.ts production branch).
# NODE_ENV=production is load-bearing: it makes the server serve dist/ (not the Vite dev middleware)
# and keeps the upload route fail-closed (no local-disk evidence fallback on ephemeral storage).
# It is set AFTER install/build so `npm ci` does not prune the devDependencies the build needs.
#
# Build-time VITE_* values are PUBLIC by design (inlined into the client bundle) and may be passed as
# --build-arg. The Gemini key is a RUNTIME secret and must NEVER be a build arg or baked into the
# image; inject it at runtime via Secret Manager / the platform env.
#
# Node is pinned to 22 to match CI (.github/workflows/ci.yml). A future optimization could split this
# into a multi-stage build with `npm ci --omit=dev` for a smaller runtime image (`vite` is a runtime
# dependency, so it survives the prune); kept single-stage here for an obviously-correct scaffold.
FROM node:22-bookworm-slim

WORKDIR /app

# Public, build-time Firebase web config (inlined by `vite build`). Pass via --build-arg in staging.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_FIRESTORE_DATABASE_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIREBASE_FIRESTORE_DATABASE_ID=$VITE_FIREBASE_FIRESTORE_DATABASE_ID

# Install with the lockfile first for layer caching. devDependencies (esbuild/tsx/typescript/tailwind)
# are required to build; `vite` is a runtime dependency used by the server bundle.
COPY package.json package-lock.json ./
RUN npm ci

# App source (see .dockerignore: .env*, secrets, local data, .git, dist, node_modules are excluded).
COPY . .

# Produce dist/ (client SPA) and dist/server.cjs (server bundle).
RUN npm run build

# Set production AFTER the build so the running container serves dist/ and stays fail-closed.
ENV NODE_ENV=production

# Cloud Run injects PORT; server.ts honors process.env.PORT and falls back to 3000.
EXPOSE 3000

CMD ["npm", "start"]
