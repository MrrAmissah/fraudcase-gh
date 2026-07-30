#!/usr/bin/env node
/**
 * Boot-and-probe smoke test for the built production server.
 *
 *   npm run build && npm run test:smoke
 *
 * WHY THIS EXISTS: every other test in this repo is a unit test of a pure function, so nothing
 * ever started the server. The express 4 -> 5 upgrade broke the SPA fallback route (express 5 uses
 * path-to-regexp v8, which rejects the bare `"*"` pattern) and the whole suite still passed,
 * because that failure happens at route registration, not inside any tested function. Reaching
 * "listening" at all is therefore the single most valuable assertion here.
 *
 * PRODUCTION MODE ONLY. The static-file serving and the `/{*splat}` SPA fallback live in the
 * `NODE_ENV === "production"` branch of server.ts; in dev those paths are handled by Vite
 * middleware instead. Running this against `npm run dev` will fail confusingly, so it always
 * spawns the built bundle with NODE_ENV=production.
 *
 * NO CREDENTIALS NEEDED. firebase-admin resolves credentials lazily, so the server boots with an
 * empty environment and no .env file (verified). Every probe below is chosen to stay on the near
 * side of any Firestore or Gemini call.
 *
 * NEVER POST REAL TEXT to the Quick Check routes here: a non-empty body reaches Gemini and bills
 * a real API call. The empty and malformed bodies below are rejected by the route guard and the
 * body parser respectively, which is exactly what we want to assert anyway.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const PORT = Number(process.env.SMOKE_PORT || 3199);
const BASE = `http://127.0.0.1:${PORT}`;
const BUNDLE = path.join(process.cwd(), "dist", "server.cjs");
const READY_TIMEOUT_MS = 30_000;

if (!fs.existsSync(BUNDLE)) {
  console.error(`✗ ${BUNDLE} not found. Run \`npm run build\` first.`);
  process.exit(1);
}

let output = "";
const child = spawn(process.execPath, [BUNDLE], {
  env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (d) => (output += d));
child.stderr.on("data", (d) => (output += d));

let exitedEarly = null;
child.on("exit", (code, signal) => (exitedEarly = { code, signal }));

async function get(pathname, init) {
  return fetch(`${BASE}${pathname}`, { signal: AbortSignal.timeout(10_000), ...init });
}

async function waitForReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exitedEarly) {
      throw new Error(
        `server exited before becoming ready (code ${exitedEarly.code}, signal ${exitedEarly.signal})`,
      );
    }
    try {
      const res = await get("/api/health");
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not answer /api/health within ${READY_TIMEOUT_MS}ms (port ${PORT} in use?)`);
}

const failures = [];
let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  ✗ ${name} — ${err.message}`);
  }
}

function expectStatus(res, want) {
  if (res.status !== want) throw new Error(`expected ${want}, got ${res.status}`);
}

function expectContentType(res, fragment) {
  const got = res.headers.get("content-type") || "";
  if (!got.includes(fragment)) throw new Error(`expected content-type containing "${fragment}", got "${got}"`);
}

try {
  await waitForReady();
  console.log(`Server booted on ${BASE}\n`);

  await check("GET /api/health returns ok JSON", async () => {
    const res = await get("/api/health");
    expectStatus(res, 200);
    expectContentType(res, "application/json");
    const body = await res.json();
    if (body.status !== "ok") throw new Error(`expected status "ok", got ${JSON.stringify(body.status)}`);
  });

  // The three SPA-fallback probes are the express-5 routing regression guard.
  await check("GET / serves the SPA", async () => {
    const res = await get("/");
    expectStatus(res, 200);
    expectContentType(res, "text/html");
  });

  await check("GET /quick-check serves the SPA (top-level client route)", async () => {
    const res = await get("/quick-check");
    expectStatus(res, 200);
    expectContentType(res, "text/html");
  });

  await check("GET /cases/:id serves the SPA (nested client route)", async () => {
    const res = await get("/cases/smoke-test-id");
    expectStatus(res, 200);
    expectContentType(res, "text/html");
  });

  await check("POST /api/quick-check/analyze rejects an empty body with 400", async () => {
    const res = await get("/api/quick-check/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"text":""}',
    });
    expectStatus(res, 400);
  });

  await check("POST /api/quick-check/analyze rejects malformed JSON with 400", async () => {
    const res = await get("/api/quick-check/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"text":',
    });
    expectStatus(res, 400);
  });

  await check("POST /api/cases without a token is rejected with 401", async () => {
    const res = await get("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"title":"smoke"}',
    });
    expectStatus(res, 401);
  });
} catch (err) {
  failures.push(`startup: ${err.message}`);
  console.log(`  ✗ startup — ${err.message}`);
} finally {
  child.kill("SIGTERM");
}

console.log("");
if (failures.length > 0) {
  console.error(`${failures.length} smoke check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error("\n--- server output ---");
  console.error(output.trim() || "(no output captured)");
  process.exit(1);
}

console.log(`All ${passed} smoke checks passed.`);
process.exit(0);
