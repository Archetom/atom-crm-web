/**
 * The access context is an opaque key derived from the server authorization
 * bootstrap. It partitions metadata cache entries; it must never be used as a
 * client-side authorization decision.
 */
export function createFieldMetadataQueryKeys(
  identityKey: string,
  objectType: string,
  accessContextKey: string,
) {
  const all = ["field-metadata", identityKey, objectType, accessContextKey] as const;

  return {
    all,
    definitions: [...all, "definitions"] as const,
    layout: [...all, "layout"] as const,
  };
}
