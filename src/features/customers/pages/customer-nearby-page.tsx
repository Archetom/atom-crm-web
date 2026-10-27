import { EnvironmentOutlined, LeftOutlined, StarFilled, StarOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Select, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import {
  defaultPageRequest,
  normalizePageRequest,
  toPageResult,
  type PageResult,
} from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";

import { type CustomerNearbyItem, toCustomerNearbyItem } from "../model/customer-nearby-item";
import { customerKeys } from "../model/query-keys";

import styles from "./customer-nearby-page.module.css";

interface Coordinates {
  longitude: number;
  latitude: number;
}

const defaultRadiusMeters = 5000;
const radiusOptions = [
  { label: "1 千米", value: 1000 },
  { label: "5 千米", value: 5000 },
  { label: "10 千米", value: 10000 },
  { label: "50 千米", value: 50000 },
];

function updateSearch(
  current: URLSearchParams,
  update: Record<string, number | string | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

function radiusFromSearch(value: string | null): number {
  const radius = Number.parseInt(value ?? "", 10);
  return radiusOptions.some((option) => option.value === radius) ? radius : defaultRadiusMeters;
}

function coordinateFromPosition(position: GeolocationPosition): Coordinates | null {
  const { latitude, longitude } = position.coords;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "定位权限未授予，无法查询附近客户。";
    case error.POSITION_UNAVAILABLE:
      return "当前位置暂时不可用，请稍后重试。";
    case error.TIMEOUT:
      return "获取当前位置超时，请稍后重试。";
    default:
      return "当前位置暂时不可用，请稍后重试。";
  }
}

function displayDistance(distanceMeters: number): string {
  return `${distanceMeters.toLocaleString("zh-CN")} 米`;
}

const columns: ColumnsType<CustomerNearbyItem> = [
  {
    dataIndex: ["customer", "name"],
    key: "name",
    title: "客户名称",
    render: (_: unknown, item) => (
      <Space size="small">
        {item.customer.starred ? (
          <StarFilled aria-label="已关注" />
        ) : (
          <StarOutlined aria-label="未关注" />
        )}
        <Typography.Text strong>
          <Link to={`/crm/customers/${item.customer.id}`}>{item.customer.name}</Link>
        </Typography.Text>
      </Space>
    ),
  },
  {
    dataIndex: "distanceMeters",
    key: "distanceMeters",
    title: "距离",
    render: displayDistance,
  },
  {
    dataIndex: ["customer", "phoneNumber"],
    key: "phoneNumber",
    title: "联系电话",
    render: (_: unknown, item) => item.customer.phoneNumber ?? "—",
  },
  {
    dataIndex: ["customer", "ownerActorId"],
    key: "ownerActorId",
    title: "负责人",
    render: (_: unknown, item) =>
      item.customer.ownerActorId === null ? "—" : `成员 ${item.customer.ownerActorId}`,
  },
  {
    dataIndex: ["customer", "status"],
    key: "status",
    title: "状态",
    render: (_: unknown, item) => item.customer.status ?? "—",
  },
];

export function CustomerNearbyPage() {
  const { apiClient } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const radiusMeters = radiusFromSearch(searchParams.get("radius"));
  const pageRequest = normalizePageRequest({
    page: Number.parseInt(searchParams.get("page") ?? "", 10),
    size: Number.parseInt(searchParams.get("size") ?? "", 10),
  });
  const nearbyRequest =
    coordinates === null
      ? null
      : {
          longitude: coordinates.longitude,
          latitude: coordinates.latitude,
          radiusMeters,
          ...pageRequest,
        };
  const identityKey = authState?.identityKey ?? "pending";
  const nearbyQuery = useQuery({
    queryKey:
      nearbyRequest === null
        ? customerKeys.nearbyPending(identityKey)
        : customerKeys.nearby(identityKey, [
            nearbyRequest.longitude,
            nearbyRequest.latitude,
            nearbyRequest.radiusMeters,
            nearbyRequest.page,
            nearbyRequest.size,
          ]),
    queryFn: () =>
      apiClient === null || nearbyRequest === null
        ? Promise.reject(new Error("Nearby customers are unavailable."))
        : apiClient.getNearbyCustomers(nearbyRequest),
    enabled: apiClient !== null && nearbyRequest !== null,
  });
  const nearbyPage: PageResult<CustomerNearbyItem> = nearbyQuery.data
    ? toPageResult(nearbyQuery.data, toCustomerNearbyItem)
    : { ...defaultPageRequest, items: [], total: null, meta: {} };

  function setPage(nextPage: number, nextSize: number) {
    setSearchParams(updateSearch(searchParams, { page: nextPage, size: nextSize }));
  }

  function setRadius(nextRadius: number) {
    setSearchParams(updateSearch(searchParams, { radius: nextRadius, page: 1 }));
  }

  function requestLocation() {
    setLocationError(null);
    if (!("geolocation" in navigator)) {
      setLocationError("当前浏览器不支持定位，无法查询附近客户。");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoordinates = coordinateFromPosition(position);
        setLocating(false);
        if (nextCoordinates === null) {
          setLocationError("当前位置数据无效，请稍后重试。");
          return;
        }
        setCoordinates(nextCoordinates);
        setSearchParams(updateSearch(searchParams, { page: 1 }));
      },
      (error) => {
        setLocating(false);
        setLocationError(geolocationErrorMessage(error));
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 },
    );
  }

  return (
    <RouteAuthority authority={authority.customersRead}>
      <main className={styles.page}>
        <section className={styles.toolbar}>
          <div>
            <Button icon={<LeftOutlined />} type="link" onClick={() => navigate("/crm/customers")}>
              返回客户列表
            </Button>
            <Typography.Title level={2}>附近客户</Typography.Title>
            <Typography.Text type="secondary">
              首期按服务端距离排序显示，不接入地图；位置仅用于本页当前查询，不会写入 URL
              或本地存储。
            </Typography.Text>
          </div>
          <div className={styles.controls}>
            <label>
              <Typography.Text>搜索半径</Typography.Text>
              <Select<number>
                aria-label="搜索半径"
                className={styles.radius}
                options={radiusOptions}
                value={radiusMeters}
                onChange={setRadius}
              />
            </label>
            <Button
              icon={<EnvironmentOutlined />}
              loading={locating}
              type="primary"
              onClick={requestLocation}
            >
              {coordinates === null ? "获取当前位置" : "重新获取当前位置"}
            </Button>
          </div>
        </section>
        {locationError !== null ? <Alert title={locationError} showIcon type="warning" /> : null}
        {coordinates === null && locationError === null ? (
          <Alert title="请先授权浏览器定位，再查询附近客户。" showIcon type="info" />
        ) : null}
        {nearbyQuery.isError ? (
          <Alert
            title={
              nearbyQuery.error instanceof ApiError
                ? nearbyQuery.error.message
                : "附近客户暂时无法加载"
            }
            showIcon
            type="error"
          />
        ) : null}
        {coordinates !== null ? (
          <ResponsiveDataList
            columns={columns}
            loading={nearbyQuery.isLoading}
            page={nearbyPage}
            rowKey={(item) => item.customer.id}
            renderMobileItem={(item) => (
              <Card
                className={styles.mobileCard}
                size="small"
                title={<Link to={`/crm/customers/${item.customer.id}`}>{item.customer.name}</Link>}
              >
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>{displayDistance(item.distanceMeters)}</Typography.Text>
                  <Typography.Text>{item.customer.phoneNumber ?? "未提供联系电话"}</Typography.Text>
                  <Typography.Text>
                    {item.customer.ownerActorId === null
                      ? "未分配负责人"
                      : `成员 ${item.customer.ownerActorId}`}
                  </Typography.Text>
                  <div className={styles.mobileMeta}>
                    {item.customer.status ? <Tag>{item.customer.status}</Tag> : null}
                    {item.customer.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </Space>
              </Card>
            )}
            onPageChange={setPage}
          />
        ) : null}
      </main>
    </RouteAuthority>
  );
}
