import type { components } from "~/api/generated/schema";

/**
 * Which product image slot an upload targets.
 *
 * This lives in the products feature rather than the API client because it is a product
 * domain concept. Keeping it here also breaks the import cycle the client previously had
 * with `product-form`: this module depends only on the generated snapshot.
 */
export type ProductImageType = NonNullable<
  components["schemas"]["AttachmentUploadIntentCreateRequest"]["productImageType"]
>;
