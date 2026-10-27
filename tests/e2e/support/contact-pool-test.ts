import { test as base } from "@playwright/test";
import { mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.env.ATOM_CRM_WEB_E2E_BASE_URL ?? "http://localhost:5173";
const lockPath = join(tmpdir(), "atom-crm-web-contact-pool-e2e.lock");
const staleLockAgeMs = 60_000;
const contactPoolTestTimeoutMs = 120_000;

interface ContactPoolTestIdentity {
  id: number;
  headers: Record<string, string>;
}

function isFileSystemError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function acquireContactPoolLock(): Promise<void> {
  for (;;) {
    try {
      await mkdir(lockPath);
      return;
    } catch (error) {
      if (!isFileSystemError(error, "EEXIST")) throw error;

      try {
        const lock = await stat(lockPath);
        if (Date.now() - lock.mtimeMs > staleLockAgeMs) {
          await rm(lockPath, { force: true, recursive: true });
          continue;
        }
      } catch (statError) {
        if (isFileSystemError(statError, "ENOENT")) continue;
        throw statError;
      }

      await wait(50);
    }
  }
}

export const test = base.extend<{ contactPoolIdentity: ContactPoolTestIdentity }>({
  contactPoolIdentity: [
    async ({ page }, use, testInfo) => {
      await acquireContactPoolLock();
      const id = Date.now() * 100 + testInfo.parallelIndex * 10 + testInfo.retry;
      const headers = {
        "X-Dev-Tenant-Id": String(id),
        "X-Dev-User-Id": String(id),
      };
      const response = await page.request.post(`${baseUrl}/api/v1/organization/bootstrap`, {
        data: { displayName: "E2E Tenant Owner" },
        headers,
      });

      if (!response.ok()) {
        await rm(lockPath, { force: true, recursive: true });
        throw new Error(
          `Failed to bootstrap isolated contact-pool E2E tenant (${response.status()}).`,
        );
      }

      await page.addInitScript((identityId: number) => {
        sessionStorage.setItem("atom-crm.dev.actor-id", String(identityId));
        sessionStorage.setItem("atom-crm.dev.tenant-id", String(identityId));
      }, id);
      await use({ id, headers });
      await rm(lockPath, { force: true, recursive: true });
    },
    { auto: true, timeout: contactPoolTestTimeoutMs },
  ],
});

// Contact-pool scenarios deliberately serialize tenant bootstrap and cleanup
// through a process-wide lock. Keep their test budget aligned with that lock
// rather than treating queued isolation as a product timeout.
test.beforeEach(({ page }, testInfo) => {
  void page;
  testInfo.setTimeout(contactPoolTestTimeoutMs);
});

export { expect } from "@playwright/test";
