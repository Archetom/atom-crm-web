const origin = (process.env.ATOM_CRM_API_ORIGIN ?? "http://localhost:8080").replace(/\/$/, "");
const actorId = process.env.ATOM_CRM_E2E_ACTOR_ID ?? "900001";
const tenantId = process.env.ATOM_CRM_E2E_TENANT_ID ?? "900001";

const response = await fetch(`${origin}/api/v1/organization/bootstrap`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Dev-User-Id": actorId,
    "X-Dev-Tenant-Id": tenantId,
  },
  body: JSON.stringify({ displayName: "E2E Tenant Owner" }),
});

if (!response.ok && response.status !== 409) {
  throw new Error(`E2E seed bootstrap failed with HTTP ${response.status}.`);
}

console.log(`E2E tenant ${tenantId} is ready for actor ${actorId}.`);
