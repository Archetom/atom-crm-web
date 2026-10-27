import type { ComponentProps } from "react";

import { CreateFileFieldControls } from "~/components/dynamic-field/components/create-file-field-controls";

/** Compatibility boundary for the existing customer creation flow. */
export type CustomerCreateFileFields = ComponentProps<
  typeof CreateFileFieldControls
>["filesByField"];

export function CustomerCreateFileFieldControls(
  props: Readonly<Omit<ComponentProps<typeof CreateFileFieldControls>, "bindingObjectName">>,
) {
  return <CreateFileFieldControls bindingObjectName="客户" {...props} />;
}
