import { Button, Input, Space, Tag } from "antd";
import type { ReactNode } from "react";

import styles from "./filter-bar.module.css";

export interface ActiveFilter {
  key: string;
  label: string;
  onClear?(): void;
}

interface FilterBarProps {
  activeFilters?: readonly ActiveFilter[];
  children?: ReactNode;
  onClearAll?(): void;
  search?: {
    label: string;
    placeholder: string;
    value?: string;
    onSearch(value: string): void;
  };
  trailing?: ReactNode;
}

export function FilterBar({
  activeFilters = [],
  children,
  onClearAll,
  search,
  trailing,
}: Readonly<FilterBarProps>) {
  return (
    <section aria-label="筛选与视图" className={styles.root}>
      <div className={styles.controls}>
        {search ? (
          <Input.Search
            allowClear
            aria-label={search.label}
            className={styles.search}
            defaultValue={search.value}
            key={search.value}
            placeholder={search.placeholder}
            onSearch={search.onSearch}
          />
        ) : null}
        {children}
      </div>
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
      {activeFilters.length > 0 ? (
        <div className={styles.summary} aria-label="已生效的筛选条件">
          <Space size={[6, 6]} wrap>
            <span className={styles.summaryLabel}>已筛选</span>
            {activeFilters.map((filter) => (
              <Tag
                key={filter.key}
                closable={filter.onClear !== undefined}
                onClose={(event) => {
                  event.preventDefault();
                  filter.onClear?.();
                }}
              >
                {filter.label}
              </Tag>
            ))}
            {onClearAll ? (
              <Button size="small" type="link" onClick={onClearAll}>
                清除全部条件
              </Button>
            ) : null}
          </Space>
        </div>
      ) : null}
    </section>
  );
}
