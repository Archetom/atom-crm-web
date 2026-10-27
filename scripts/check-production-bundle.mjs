import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const clientDirectory = fileURLToPath(new URL("../build/client", import.meta.url));
const maximumJavaScriptGzipBytes = 100 * 1024;
const forbiddenProductionValues = [
  "X-Dev-User-Id",
  "X-Dev-Tenant-Id",
  "atom-crm.dev.actor-id",
  "atom-crm.dev.tenant-id",
  "VITE_ENABLE_DEV_AUTH",
  "/dev/session",
];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return files.flat();
}

const files = await listFiles(clientDirectory);
const browserFiles = files.filter((file) => /\.(?:css|html|js)$/u.test(file));
const javascriptFiles = browserFiles.filter((file) => file.endsWith(".js"));

if (javascriptFiles.length === 0) {
  throw new Error("No JavaScript assets were found in build/client. Run pnpm build first.");
}

const forbiddenMatches = [];
for (const file of browserFiles) {
  const contents = await readFile(file, "utf8");
  for (const value of forbiddenProductionValues) {
    if (contents.includes(value)) forbiddenMatches.push(`${file}: ${value}`);
  }
}

if (forbiddenMatches.length > 0) {
  throw new Error(
    `Production bundle contains development-only authentication code:\n${forbiddenMatches.join("\n")}`,
  );
}

const compressedAssets = await Promise.all(
  javascriptFiles.map(async (file) => ({
    file,
    gzipBytes: gzipSync(await readFile(file)).byteLength,
  })),
);
const largestAsset = compressedAssets.reduce((largest, asset) =>
  asset.gzipBytes > largest.gzipBytes ? asset : largest,
);

if (largestAsset.gzipBytes > maximumJavaScriptGzipBytes) {
  throw new Error(
    `Largest JavaScript asset exceeds the ${maximumJavaScriptGzipBytes} byte gzip budget: ${largestAsset.file} (${largestAsset.gzipBytes} bytes).`,
  );
}

console.log(
  `Production browser bundle verified: ${javascriptFiles.length} JavaScript assets; largest gzip asset ${Math.ceil(largestAsset.gzipBytes / 1024)} KiB.`,
);
