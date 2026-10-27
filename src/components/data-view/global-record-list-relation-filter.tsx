import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Input, List, Modal, Typography } from "antd";
import { useState, type ReactNode } from "react";

import type { ApiClient } from "~/api/client/api-client";
import { ApiError } from "~/api/errors/api-error";
import type { ActiveFilter } from "~/components/page/filter-bar";

import {
  globalRecordListConfirmedRelationId,
  globalRecordListPositiveIdFromSearch,
} from "./global-record-list-scene";

export interface GlobalRecordListRelationOption {
  id: number;
  name: string;
}

/** A typed relation selector backed only by the caller's server-visible directory. */
export interface GlobalRecordListRelationFilter {
  additionalAuthorities?: readonly string[];
  authority: string;
  label: string;
  parameter: string;
  loadOptions(
    apiClient: ApiClient,
    keyword: string,
  ): Promise<readonly GlobalRecordListRelationOption[]>;
  resolveOption(apiClient: ApiClient, id: number): Promise<GlobalRecordListRelationOption>;
}

interface RelationFilterState {
  activeFilter: ActiveFilter | undefined;
  confirmedId: number | undefined;
  controls: ReactNode;
  error: unknown;
  modal: ReactNode;
  ready: boolean;
}

interface UseGlobalRecordListRelationFilterInput {
  apiClient: ApiClient | null;
  canUse: boolean;
  filter: GlobalRecordListRelationFilter | undefined;
  identityKey: string;
  searchParams: URLSearchParams;
  setSearchParams(value: URLSearchParams): void;
}

function updateSearch(
  current: URLSearchParams,
  update: Record<string, number | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined) next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

/**
 * Keeps a relation parameter out of its record query until the same caller has
 * confirmed the exact selected entity. It also owns the keyboard-accessible
 * candidate dialog and URL recovery behavior for that filter.
 */
export function useGlobalRecordListRelationFilter({
  apiClient,
  canUse,
  filter,
  identityKey,
  searchParams,
  setSearchParams,
}: Readonly<UseGlobalRecordListRelationFilterInput>): RelationFilterState {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const requestedId =
    filter === undefined || !canUse
      ? undefined
      : globalRecordListPositiveIdFromSearch(searchParams.toString(), filter.parameter);
  const candidateQuery = useQuery({
    queryKey: [
      "global-record-list-relation-selector",
      identityKey,
      filter?.parameter,
      keyword,
    ] as const,
    queryFn: () => {
      if (apiClient === null || filter === undefined) {
        return Promise.reject(new Error("Relation selection is unavailable."));
      }
      return filter.loadOptions(apiClient, keyword.trim());
    },
    enabled: apiClient !== null && filter !== undefined && open && canUse,
  });
  const selectedQuery = useQuery({
    queryKey: [
      "global-record-list-selected-relation",
      identityKey,
      filter?.parameter,
      requestedId,
    ] as const,
    queryFn: () => {
      if (apiClient === null || filter === undefined || requestedId === undefined) {
        return Promise.reject(new Error("Selected relation is unavailable."));
      }
      return filter.resolveOption(apiClient, requestedId);
    },
    enabled: apiClient !== null && filter !== undefined && requestedId !== undefined && canUse,
  });
  const confirmedId = globalRecordListConfirmedRelationId(requestedId, selectedQuery.data?.id);
  const ready = requestedId === undefined || confirmedId !== undefined;

  function close() {
    setOpen(false);
    setKeyword("");
  }

  function select(option: GlobalRecordListRelationOption) {
    if (filter === undefined) return;
    close();
    setSearchParams(updateSearch(searchParams, { [filter.parameter]: option.id, page: 1 }));
  }

  function clear() {
    if (filter === undefined) return;
    setSearchParams(updateSearch(searchParams, { [filter.parameter]: undefined, page: 1 }));
  }

  const label = filter?.label ?? "关联记录";
  const activeFilter =
    requestedId === undefined
      ? undefined
      : {
          key: filter?.parameter ?? "relation",
          label: `${label}：${confirmedId === undefined ? "正在确认" : (selectedQuery.data?.name ?? "正在确认")}`,
          onClear: clear,
        };

  return {
    activeFilter,
    confirmedId,
    controls:
      filter !== undefined && canUse ? (
        <Button onClick={() => setOpen(true)}>{`筛选${label}`}</Button>
      ) : null,
    error: selectedQuery.isError ? selectedQuery.error : undefined,
    modal:
      filter === undefined ? null : (
        <Modal destroyOnHidden footer={null} open={open} title={`筛选${label}`} onCancel={close}>
          <Typography.Paragraph type="secondary">
            候选仅来自服务端返回的当前可见{label}；筛选请求仍会由服务端复核数据范围。
          </Typography.Paragraph>
          <Input.Search
            allowClear
            aria-label={`搜索可见${label}`}
            placeholder={`搜索可见${label}`}
            value={keyword}
            onChange={(event) => setKeyword(event.currentTarget.value)}
          />
          {candidateQuery.isError ? (
            <Alert
              title={
                candidateQuery.error instanceof ApiError
                  ? candidateQuery.error.message
                  : `${label}候选列表暂时无法加载，请稍后重试`
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : (
            <List
              dataSource={[...(candidateQuery.data ?? [])]}
              loading={candidateQuery.isLoading}
              locale={{ emptyText: `未找到可选择${label}` }}
              renderItem={(option) => (
                <List.Item
                  actions={[
                    <Button key={option.id} type="link" onClick={() => select(option)}>
                      筛选
                    </Button>,
                  ]}
                >
                  <List.Item.Meta title={option.name} />
                </List.Item>
              )}
            />
          )}
        </Modal>
      ),
    ready,
  };
}
