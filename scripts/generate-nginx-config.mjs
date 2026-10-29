import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const html = await readFile(new URL("../build/client/index.html", import.meta.url), "utf8");
const template = await readFile(
  new URL("../deploy/nginx/default.conf.template", import.meta.url),
  "utf8",
);
const placeholder = "__ATOM_CRM_SCRIPT_HASHES__";
if (!template.includes(placeholder)) {
  throw new Error("Nginx template is missing the build-time script hash placeholder.");
}

// Read only the trusted HTML emitted by this build. Preserve script whitespace:
// CSP hashes cover the exact inline contents, excluding the surrounding tags.
const hashes = new Set();
for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu)) {
  if (/(?:^|\s)src\s*=/iu.test(attributes)) continue;
  hashes.add(`'sha256-${createHash("sha256").update(body).digest("base64")}'`);
}

const outputDirectory = new URL("../build/nginx/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  new URL("default.conf.template", outputDirectory),
  template.replaceAll(placeholder, [...hashes].join(" ")),
  "utf8",
);
console.log(`Generated Nginx configuration with ${hashes.size} build-specific script hashes.`);
