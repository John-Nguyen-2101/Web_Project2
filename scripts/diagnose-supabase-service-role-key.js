const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function loadLocalEnv() {
  const envPath = path.join(PROJECT_ROOT, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function decodeBase64UrlJson(value, label) {
  try {
    const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
    const json = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

    return JSON.parse(json);
  } catch (error) {
    throw new Error(`Could not decode JWT ${label}.`);
  }
}

function getProjectRefFromUrl(urlValue) {
  if (!urlValue) {
    return null;
  }

  try {
    const hostname = new URL(urlValue).hostname;
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);

    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

function main() {
  loadLocalEnv();

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  const parts = key.split(".");

  if (parts.length !== 3) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not a JWT-shaped value.");
  }

  decodeBase64UrlJson(parts[0], "header");
  const payload = decodeBase64UrlJson(parts[1], "payload");
  const role = payload.role || null;
  const issuer = payload.iss || null;
  const projectRef = payload.ref || payload.project_ref || getProjectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  console.log(
    JSON.stringify(
      {
        jwt_role_claim: role,
        issuer,
        project_ref: projectRef,
        appears_to_be_service_role: role === "service_role",
      },
      null,
      2,
    ),
  );
}

main();
