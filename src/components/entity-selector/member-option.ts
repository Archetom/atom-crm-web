import { recordOf } from "~/shared/utils/decode";

export interface MemberOption {
  actorId: number;
  displayName: string;
}

/** Decodes only active, server-visible members for entity selection. */
export function decodeMemberOptions(value: unknown): readonly MemberOption[] {
  const source = recordOf(value);
  if (source === null || !Array.isArray(source.objectList)) {
    throw new Error("成员选择数据暂时不可用，请稍后重试。");
  }

  const known = new Set<number>();
  return source.objectList.flatMap((item) => {
    const member = recordOf(item);
    const actorId = member?.actorId;
    const displayName = member?.displayName;
    if (
      member === null ||
      typeof actorId !== "number" ||
      !Number.isSafeInteger(actorId) ||
      actorId <= 0 ||
      typeof displayName !== "string" ||
      displayName.trim().length === 0 ||
      member.active !== true ||
      known.has(actorId)
    ) {
      return [];
    }

    known.add(actorId);
    return [{ actorId, displayName }];
  });
}
