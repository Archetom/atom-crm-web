import { Card, Empty, Select, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import type { components } from "~/api/generated/schema";

import { formatMetric, formatServerAmount } from "../model/format";

type DashboardRanking = components["schemas"]["RankingResponse"];
type DashboardRankingItem = components["schemas"]["RankingItemResponse"];

const columns: ColumnsType<DashboardRankingItem> = [
  { dataIndex: "rank", key: "rank", title: "排名", width: 72 },
  {
    dataIndex: "ownerActorId",
    key: "ownerActorId",
    title: "负责人",
    render: (actorId: number) => `成员 #${actorId}`,
  },
  { dataIndex: "count", key: "count", title: "数量" },
  {
    dataIndex: "amount",
    key: "amount",
    title: "金额",
    render: (amount: number) => formatServerAmount(amount),
  },
];

/** Renders a server-ranked metric without re-querying or broadening dashboard visibility. */
export function DashboardRankingPanel({
  from,
  rankings,
  to,
}: Readonly<{
  from: string;
  rankings: readonly DashboardRanking[];
  to: string;
}>) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const ranking = rankings.find((candidate) => candidate.metric === selectedMetric) ?? rankings[0];

  return (
    <Card
      extra={
        rankings.length > 0 ? (
          <Select
            aria-label="排行榜指标"
            options={rankings.map((candidate) => ({
              label: formatMetric(candidate.metric),
              value: candidate.metric,
            }))}
            value={ranking?.metric}
            onChange={(metric: string) => setSelectedMetric(metric)}
          />
        ) : undefined
      }
      title={
        <Typography.Title level={2} style={{ fontSize: "inherit", margin: 0 }}>
          排行榜
        </Typography.Title>
      }
    >
      {ranking === undefined ? (
        <Empty description="暂无可展示的排行指标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : ranking.status === "UNAVAILABLE" ? (
        <Empty
          description="当前权限范围内暂不可展示该指标排行"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : ranking.items.length === 0 ? (
        <Empty description="该时间范围内暂无排行数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <>
          <Typography.Paragraph type="secondary">
            {`${formatMetric(ranking.metric)} · ${from} 至 ${to} · 与上方工作台筛选一致`}
          </Typography.Paragraph>
          <Table<DashboardRankingItem>
            columns={columns}
            dataSource={ranking.items}
            pagination={false}
            rowKey={(item) => `${item.ownerActorId}-${item.rank}`}
            size="small"
          />
        </>
      )}
    </Card>
  );
}
