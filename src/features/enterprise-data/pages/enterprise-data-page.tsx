import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Input,
  InputNumber,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useState } from "react";

import type { components } from "~/api/generated/schema";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";

import { enterpriseDataKeys } from "../model/query-keys";

type Observation = components["schemas"]["EnterpriseDataObservationResponse"];
type AdoptionPreview = components["schemas"]["EnterpriseDataAdoptionPreviewResponse"];
interface SafeIdentifier {
  canonicalValue: string;
  identityScope: string;
  registryScheme: string;
}

interface AdoptionState {
  customerId: number;
  customerVersion: number;
  observation: Observation;
  preview: AdoptionPreview;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function primaryIdentifier(observation: Observation): SafeIdentifier | null {
  const identifier = observation.primaryIdentifier;
  if (!identifier?.identityScope || !identifier.registryScheme || !identifier.canonicalValue)
    return null;
  return {
    canonicalValue: identifier.canonicalValue,
    identityScope: identifier.identityScope,
    registryScheme: identifier.registryScheme,
  };
}

function formatAddress(observation: Observation): string {
  const address = observation.registeredAddress;
  if (!address) return "未提供";
  return [
    address.countryCode,
    address.region,
    address.locality,
    address.addressLine,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(" · ");
}

function ObservationCard({
  observation,
  onAdopt,
}: {
  observation: Observation;
  onAdopt: (observation: Observation) => void;
}) {
  const identifier = primaryIdentifier(observation);
  const canAdopt = observation.usageMode === "ADOPT_SELECTED_FACTS" && identifier !== null;
  return (
    <Card
      size="small"
      title={observation.registeredName ?? "未命名登记主体"}
      extra={observation.entityStatus ? <Tag>{observation.entityStatus}</Tag> : null}
    >
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="登记身份">
          {identifier
            ? `${identifier.identityScope} / ${identifier.registryScheme} / ${identifier.canonicalValue}`
            : "未提供"}
        </Descriptions.Item>
        <Descriptions.Item label="法律辖区">
          {observation.legalJurisdiction ?? "未提供"}
        </Descriptions.Item>
        <Descriptions.Item label="注册地址" span={2}>
          {formatAddress(observation)}
        </Descriptions.Item>
        <Descriptions.Item label="来源">
          {observation.attribution?.sourceName ?? observation.sourceKind ?? "未提供"}
        </Descriptions.Item>
        <Descriptions.Item label="使用模式">{observation.usageMode ?? "未提供"}</Descriptions.Item>
      </Descriptions>
      {canAdopt ? (
        <Space style={{ marginTop: 12 }}>
          <Button onClick={() => onAdopt(observation)}>采纳至客户</Button>
        </Space>
      ) : null}
    </Card>
  );
}

export function EnterpriseDataPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const [messageApi, messageContext] = message.useMessage();
  const [searchName, setSearchName] = useState("");
  const [searchJurisdiction, setSearchJurisdiction] = useState("");
  const [identityScope, setIdentityScope] = useState("");
  const [registryScheme, setRegistryScheme] = useState("");
  const [identifierValue, setIdentifierValue] = useState("");
  const [adoptionObservation, setAdoptionObservation] = useState<Observation | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [addressSlotKey, setAddressSlotKey] = useState("registered");
  const [adoption, setAdoption] = useState<AdoptionState | null>(null);
  const [selectedFacts, setSelectedFacts] = useState<string[]>([]);
  const identityKey = authState?.identityKey ?? "pending";
  const canRead = hasAuthority(authorization, authority.enterpriseDataRead);
  const capabilitiesQuery = useQuery({
    queryKey: enterpriseDataKeys.capabilities(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("企业数据能力暂时不可用。"))
        : apiClient.getEnterpriseDataCapabilities(),
    enabled: apiClient !== null && canRead,
  });
  const searchMutation = useMutation({
    mutationFn: () => {
      if (apiClient === null) throw new Error("企业数据能力暂时不可用。");
      return apiClient.searchEnterpriseData({
        legalJurisdiction: searchJurisdiction.trim(),
        registeredName: searchName.trim(),
      });
    },
  });
  const lookupMutation = useMutation({
    mutationFn: () => {
      if (apiClient === null) throw new Error("企业数据能力暂时不可用。");
      return apiClient.lookupEnterpriseData({
        identityScope: identityScope.trim(),
        registryScheme: registryScheme.trim(),
        value: identifierValue.trim(),
      });
    },
  });
  const previewMutation = useMutation({
    mutationFn: async (): Promise<AdoptionState> => {
      if (apiClient === null || adoptionObservation === null || customerId === null) {
        throw new Error("请先选择企业记录和客户。");
      }
      const identifier = primaryIdentifier(adoptionObservation);
      if (identifier === null) throw new Error("该企业记录缺少可用于采纳的登记身份。");
      const customer = await apiClient.getCustomer(customerId);
      const preview = await apiClient.previewEnterpriseDataAdoption({
        addressSlotKey: addressSlotKey.trim(),
        customerId: customer.id,
        customerVersion: customer.version,
        identityScope: identifier.identityScope,
        registryScheme: identifier.registryScheme,
        value: identifier.canonicalValue,
      });
      if (!preview.previewReference || !preview.observation) {
        throw new Error("服务端未返回可提交的采纳预览。");
      }
      return {
        customerId: customer.id,
        customerVersion: customer.version,
        observation: adoptionObservation,
        preview,
      };
    },
    onSuccess: (value) => {
      setAdoption(value);
      setSelectedFacts(
        (value.preview.diffs ?? [])
          .map((diff) => diff.fact)
          .filter((fact): fact is string => Boolean(fact)),
      );
    },
  });
  const adoptMutation = useMutation({
    mutationFn: async () => {
      if (apiClient === null || adoption === null || !adoption.preview.previewReference) {
        throw new Error("请先获取有效的采纳预览。");
      }
      const identifier = primaryIdentifier(adoption.preview.observation ?? adoption.observation);
      if (identifier === null || selectedFacts.length === 0) {
        throw new Error("请选择至少一个服务端允许采纳的事实。");
      }
      return apiClient.adoptEnterpriseData({
        customerVersion: adoption.customerVersion,
        facts: selectedFacts,
        identities: [
          { identityScope: identifier.identityScope, registryScheme: identifier.registryScheme },
        ],
        previewReference: adoption.preview.previewReference,
      });
    },
    onSuccess: () => {
      void messageApi.success("企业资料已按服务端预览采纳至客户。");
      closeAdoption();
    },
  });
  const results = lookupMutation.data ? [lookupMutation.data] : (searchMutation.data ?? []);
  const operationalError =
    searchMutation.error ?? lookupMutation.error ?? previewMutation.error ?? adoptMutation.error;

  function closeAdoption() {
    setAdoptionObservation(null);
    setCustomerId(null);
    setAddressSlotKey("registered");
    setAdoption(null);
    setSelectedFacts([]);
    previewMutation.reset();
    adoptMutation.reset();
  }

  function openAdoption(observation: Observation) {
    setAdoptionObservation(observation);
    setAdoption(null);
    setSelectedFacts([]);
  }

  return (
    <RouteAuthority authority={authority.enterpriseDataRead}>
      {messageContext}
      <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
        <Typography.Title level={2} style={{ marginBottom: 0 }}>
          企业数据
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          仅查询受治理的企业登记事实。采纳前会由服务端重新精确查询、校验客户当前版本并生成短期预览。
        </Typography.Paragraph>
        {capabilitiesQuery.data?.ready === false ? (
          <Alert title="当前租户的企业数据来源尚未就绪。" showIcon type="warning" />
        ) : null}
        {operationalError ? (
          <Alert
            title={errorMessage(operationalError, "企业数据操作失败，请稍后重试。")}
            showIcon
            type="error"
          />
        ) : null}
        <Card title="按登记名称查询">
          <Space wrap>
            <Input
              value={searchName}
              onChange={(event) => setSearchName(event.target.value)}
              placeholder="登记名称"
              style={{ width: 240 }}
            />
            <Input
              value={searchJurisdiction}
              onChange={(event) => setSearchJurisdiction(event.target.value)}
              placeholder="法律辖区，例如 GB"
              style={{ width: 180 }}
            />
            <Button
              disabled={!searchName.trim() || !searchJurisdiction.trim()}
              loading={searchMutation.isPending}
              onClick={() => {
                lookupMutation.reset();
                searchMutation.mutate();
              }}
              type="primary"
            >
              查询
            </Button>
          </Space>
        </Card>
        <Card title="按登记身份精确查询">
          <Space wrap>
            <Input
              value={identityScope}
              onChange={(event) => setIdentityScope(event.target.value)}
              placeholder="identityScope"
              style={{ width: 220 }}
            />
            <Input
              value={registryScheme}
              onChange={(event) => setRegistryScheme(event.target.value)}
              placeholder="registryScheme"
              style={{ width: 180 }}
            />
            <Input
              value={identifierValue}
              onChange={(event) => setIdentifierValue(event.target.value)}
              placeholder="登记号"
              style={{ width: 220 }}
            />
            <Button
              disabled={!identityScope.trim() || !registryScheme.trim() || !identifierValue.trim()}
              loading={lookupMutation.isPending}
              onClick={() => {
                searchMutation.reset();
                lookupMutation.mutate();
              }}
              type="primary"
            >
              精确查询
            </Button>
          </Space>
        </Card>
        {results.length > 0 ? (
          <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
            <Typography.Title level={4} style={{ marginBottom: 0 }}>
              查询结果
            </Typography.Title>
            {results.map((observation, index) => (
              <ObservationCard
                key={`${observation.primaryIdentifier?.canonicalValue ?? "result"}-${index}`}
                observation={observation}
                onAdopt={openAdoption}
              />
            ))}
          </Space>
        ) : null}
      </Space>
      <Modal
        destroyOnHidden
        footer={null}
        onCancel={closeAdoption}
        open={adoptionObservation !== null}
        title="采纳企业资料至客户"
        width={720}
      >
        {adoption === null ? (
          <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
            <Alert
              description="请输入可见客户 ID。客户端会先从服务端读取该客户的当前 version，再创建调用方绑定的采纳预览。"
              showIcon
              type="info"
            />
            <Space wrap>
              <InputNumber
                min={1}
                onChange={setCustomerId}
                placeholder="客户 ID"
                value={customerId}
              />
              <Input
                onChange={(event) => setAddressSlotKey(event.target.value)}
                placeholder="地址槽位键"
                value={addressSlotKey}
                style={{ width: 180 }}
              />
              <Button
                disabled={customerId === null || !addressSlotKey.trim()}
                loading={previewMutation.isPending}
                onClick={() => previewMutation.mutate()}
                type="primary"
              >
                获取服务端预览
              </Button>
            </Space>
          </Space>
        ) : (
          <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
            <Alert
              description="仅可提交本次服务端预览中列出的事实；预览过期或客户版本变化时，服务端会拒绝提交。"
              showIcon
              type="warning"
            />
            <Descriptions column={1} size="small">
              <Descriptions.Item label="客户">
                #{adoption.customerId}（版本 {adoption.customerVersion}）
              </Descriptions.Item>
              <Descriptions.Item label="预览登记主体">
                {adoption.preview.observation?.registeredName ?? "未提供"}
              </Descriptions.Item>
            </Descriptions>
            <Divider>选择采纳事实</Divider>
            <Checkbox.Group
              onChange={(values) => setSelectedFacts(values as string[])}
              value={selectedFacts}
            >
              <Space orientation="vertical">
                {(adoption.preview.diffs ?? []).map((diff) =>
                  diff.fact ? (
                    <Checkbox key={diff.fact} value={diff.fact}>
                      {diff.fact}
                      {diff.changed ? "（将变更）" : "（无变更）"}
                    </Checkbox>
                  ) : null,
                )}
              </Space>
            </Checkbox.Group>
            <Space>
              <Button onClick={() => setAdoption(null)}>返回</Button>
              <Button
                danger
                disabled={selectedFacts.length === 0}
                loading={adoptMutation.isPending}
                onClick={() => adoptMutation.mutate()}
                type="primary"
              >
                确认采纳
              </Button>
            </Space>
          </Space>
        )}
      </Modal>
    </RouteAuthority>
  );
}
