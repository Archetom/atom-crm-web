import { Button, Empty, Grid, Pagination, Spin, Table, Typography, type TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Key, ReactNode } from "react";

import type { PageResult } from "./pagination";
import styles from "./responsive-data-list.module.css";

interface ResponsiveDataListProps<T> {
  bulkActions?: ReactNode;
  columns: ColumnsType<T>;
  /**
   * What the rows are, e.g. "客户". Ant Design's Table exposes no `caption`, so this is
   * how the list region gets a name a screen-reader user can tell apart from the next
   * page's list. Without it every list on every page is announced as "桌面列表".
   */
  label?: string;
  page: PageResult<T>;
  loading?: boolean;
  rowKey: (item: T) => Key;
  rowSelection?: TableProps<T>["rowSelection"];
  renderMobileItem(item: T): ReactNode;
  selectedRowCount?: number;
  onPageChange(page: number, size: number): void;
}

export function ResponsiveDataList<T>({
  bulkActions,
  columns,
  label,
  page,
  loading = false,
  rowKey,
  rowSelection,
  renderMobileItem,
  selectedRowCount = 0,
  onPageChange,
}: Readonly<ResponsiveDataListProps<T>>) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const hasNextPage = page.items.length === page.size;
  const empty = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
  const desktopLabel = label ? `${label}列表` : "桌面列表";
  const mobileLabel = label ? `${label}列表（移动）` : "移动列表";
  const pagerLabel = label ? `${label}列表分页` : "列表分页";

  return (
    <>
      {selectedRowCount > 0 && bulkActions ? (
        <div className={styles.bulkActions} aria-label="已选择的列表项操作">
          <Typography.Text strong>{`已选择 ${selectedRowCount} 项`}</Typography.Text>
          <div>{bulkActions}</div>
        </div>
      ) : null}
      <section className={styles.desktop} aria-label={desktopLabel}>
        <Table<T>
          columns={columns}
          dataSource={page.items}
          loading={loading}
          locale={{ emptyText: empty }}
          pagination={false}
          rowKey={rowKey}
          rowSelection={rowSelection}
          scroll={{ x: "max-content" }}
          sticky
        />
      </section>
      <section className={styles.mobile} aria-label={mobileLabel}>
        {loading ? (
          <div className={styles.mobileLoading} aria-label="正在加载列表">
            <Spin size="small" />
          </div>
        ) : page.items.length === 0 ? (
          empty
        ) : (
          <ul className={styles.mobileItems}>
            {page.items.map((item) => (
              <li key={rowKey(item)}>{renderMobileItem(item)}</li>
            ))}
          </ul>
        )}
      </section>
      {page.total === null ? (
        <div className={styles.unknownTotalPager} aria-label={pagerLabel}>
          <Button disabled={page.page === 1} onClick={() => onPageChange(page.page - 1, page.size)}>
            上一页
          </Button>
          <Typography.Text type="secondary">第 {page.page} 页</Typography.Text>
          <Button
            disabled={!hasNextPage}
            type="primary"
            onClick={() => onPageChange(page.page + 1, page.size)}
          >
            下一页
          </Button>
        </div>
      ) : (
        <div className={styles.pager} aria-label={pagerLabel}>
          <Pagination
            current={page.page}
            pageSize={page.size}
            showSizeChanger={isMobile ? false : { "aria-label": "每页显示条数" }}
            simple={isMobile}
            {...(isMobile ? { size: "small" as const } : {})}
            total={page.total}
            onChange={onPageChange}
          />
        </div>
      )}
    </>
  );
}
