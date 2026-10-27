import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const defaultOrigin = "http://localhost:8080";
const endpoint =
  process.env.ATOM_CRM_OPENAPI_URL ??
  `${(process.env.ATOM_CRM_API_ORIGIN ?? defaultOrigin).replace(/\/$/, "")}/v3/api-docs`;
const outputPath = resolve("openapi/atom-crm.json");
const temporaryPath = `${outputPath}.tmp`;

let response;
try {
  response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
} catch (error) {
  throw new Error(`Cannot reach OpenAPI endpoint ${endpoint}: ${error.message}`);
}

if (!response.ok) {
  throw new Error(`OpenAPI endpoint ${endpoint} returned HTTP ${response.status}.`);
}

let document;
try {
  document = await response.json();
} catch (error) {
  throw new Error(`OpenAPI endpoint ${endpoint} did not return JSON: ${error.message}`);
}

if (typeof document?.openapi !== "string" || !document.openapi.startsWith("3.")) {
  throw new Error(`OpenAPI endpoint ${endpoint} did not return an OpenAPI 3 document.`);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
await rename(temporaryPath, outputPath);

console.log(`Saved OpenAPI ${document.openapi} snapshot to ${outputPath}.`);
