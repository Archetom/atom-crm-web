import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { ControlledFileFieldDownloadCard } from "~/components/controlled-file-field";
import { toPageResult } from "~/components/data-view/pagination";
import {
  CustomFieldFormFields,
  createFieldMetadataQueryKeys,
  customFieldFormDefinitions,
  serverProvidedDynamicFields,
  ServerProvidedDynamicFieldDescriptions,
  validateCustomFieldFormValues,
  type CustomFieldValues,
} from "~/components/dynamic-field";
import { StatusPage } from "~/components/feedback/status-page";
import { statusKindFromError } from "~/components/feedback/status-kind";
import { ActivityTimelineCard } from "~/features/activities";
import { ApprovalStartAction } from "~/features/approvals";
import { toProductListItem } from "~/features/products";

import { contractKeys } from "../model/query-keys";
import {
  type ContractCollaborator,
  type ContractCollaboratorAccess,
} from "../model/contract-collaborator";
import type { ContractProductBaselineLine } from "../model/contract-product-baseline";
import {
  toContractBasicUpdateRequest,
  toContractCustomFieldUpdateRequest,
} from "../model/contract-form";

import styles from "./customer-contract-detail-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

type ContractProductDraftLine = Omit<ContractProductBaselineLine, "unitPrice"> & {
  unitPrice?: number;
};

const maximumContractProductInput = Number.MAX_SAFE_INTEGER;

function displayValue(value: string | null): string {
  return value ?? "—";
}

function displayReference(label: string, value: number | null): string {
  return value === null ? "—" : `${label} ${value}`;
}

export function CustomerContractDetailPage() {
  const { customerId: customerIdParam, contractId: contractIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const contractId = parseRouteId(contractIdParam);

  return <CustomerContractDetailSurface contractId={contractId} customerId={customerId} />;
}

export function CustomerContractDetailSurface({
  contractId,
  customerId,
  onClose,
}: Readonly<{
  contractId: number | null;
  customerId: number | null;
  onClose?: () => void;
}>) {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerMemberKeyword, setOwnerMemberKeyword] = useState("");
  const [basicEditorOpen, setBasicEditorOpen] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedNumber, setEditedNumber] = useState("");
  const [customFieldEditorOpen, setCustomFieldEditorOpen] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [changedCustomFieldCodes, setChangedCustomFieldCodes] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [customFieldErrors, setCustomFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [customFieldMemberKeyword, setCustomFieldMemberKeyword] = useState("");
  const [collaboratorPickerOpen, setCollaboratorPickerOpen] = useState(false);
  const [collaboratorMemberKeyword, setCollaboratorMemberKeyword] = useState("");
  const [collaboratorDraft, setCollaboratorDraft] = useState<
    readonly ContractCollaborator[] | null
  >(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productKeyword, setProductKeyword] = useState("");
  const [productDraft, setProductDraft] = useState<readonly ContractProductDraftLine[] | null>(
    null,
  );
  const identityKey = authState?.identityKey ?? "pending";
  const canReadContracts = hasAuthority(authorization, authority.contractsRead);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadProducts = hasAuthority(authorization, authority.productsRead);
  const canWriteContracts = hasAuthority(authorization, authority.contractsWrite);
  const canReadFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadFileFields =
    canReadContracts && canReadCustomers && hasAuthority(authorization, authority.filesRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canManageCollaborators = hasAuthority(authorization, authority.contractsAssign);
  const closeDetail = () => {
    if (onClose !== undefined) {
      onClose();
      return;
    }
    navigate(`/crm/customers/${customerId ?? ""}/contracts`, { replace: true });
  };
  const contractQuery = useQuery({
    queryKey:
      contractId === null
        ? contractKeys.detail(identityKey, 0)
        : contractKeys.detail(identityKey, contractId),
    queryFn: () =>
      apiClient === null || contractId === null
        ? Promise.reject(new Error("Contract detail is unavailable."))
        : apiClient.getContract(contractId),
    enabled:
      apiClient !== null &&
      customerId !== null &&
      contractId !== null &&
      canReadContracts &&
      canReadCustomers,
  });
  const fieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "CONTRACT", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contract field definitions are unavailable."))
        : apiClient.getFieldDefinitions("CONTRACT"),
    enabled:
      apiClient !== null &&
      customerId !== null &&
      contractId !== null &&
      canReadContracts &&
      canReadCustomers &&
      canReadFieldMetadata,
  });
  const customFieldDefinitions = fieldDefinitionsQuery.data ?? [];
  const customFormFieldDefinitions = customFieldFormDefinitions(customFieldDefinitions);
  const hasMemberCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "USER",
  );
  const hasDepartmentCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "DEPARTMENT",
  );
  const customFieldMemberQuery = useQuery({
    queryKey: [
      "contract-detail-custom-field-member-selector",
      identityKey,
      customFieldMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("合同自定义人员字段的成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled:
      apiClient !== null && customFieldEditorOpen && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["contract-detail-custom-field-department-selector", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("合同自定义部门字段的部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled:
      apiClient !== null &&
      customFieldEditorOpen &&
      canReadOrganization &&
      hasDepartmentCustomField,
  });
  const deleteMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || contractId === null
        ? Promise.reject(new Error("Contract deletion is unavailable."))
        : apiClient.deleteContract(contractId, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      closeDetail();
    },
  });
  const voidMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || contractId === null
        ? Promise.reject(new Error("Contract voiding is unavailable."))
        : apiClient.voidContract(contractId, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(identityKey, contractId ?? 0),
      });
    },
  });
  const basicUpdateMutation = useMutation({
    mutationFn: ({
      name,
      number,
      originalName,
      originalNumber,
      version,
    }: {
      name: string;
      number: string;
      originalName: string;
      originalNumber: string;
      version: number;
    }) =>
      apiClient === null || contractId === null
        ? Promise.reject(new Error("Contract update is unavailable."))
        : apiClient
            .updateContract(
              contractId,
              toContractBasicUpdateRequest({
                name,
                number,
                originalName,
                originalNumber,
                version,
              }),
            )
            .then((updatedContract) => {
              if (customerId !== null && updatedContract.customerId !== customerId) {
                throw new Error("更新合同响应暂时不可用，请稍后重试。");
              }
              return updatedContract;
            }),
    onSuccess: (updatedContract) => {
      queryClient.setQueryData(
        contractKeys.detail(identityKey, updatedContract.id),
        updatedContract,
      );
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      setBasicEditorOpen(false);
      setEditedName("");
      setEditedNumber("");
    },
  });
  const customFieldUpdateMutation = useMutation({
    mutationFn: ({
      changedCodes,
      values,
      version,
    }: {
      changedCodes: ReadonlySet<string>;
      values: CustomFieldValues;
      version: number;
    }) =>
      apiClient === null || contractId === null
        ? Promise.reject(new Error("Contract custom-field update is unavailable."))
        : apiClient
            .updateContract(
              contractId,
              toContractCustomFieldUpdateRequest(customFieldDefinitions, {
                changedCodes,
                customFields: values,
                version,
              }),
            )
            .then((updatedContract) => {
              if (
                updatedContract.id !== contractId ||
                (customerId !== null && updatedContract.customerId !== customerId)
              ) {
                throw new Error("Contract update response does not match the current customer.");
              }
              return updatedContract;
            }),
    onSuccess: (updatedContract) => {
      queryClient.setQueryData(
        contractKeys.detail(identityKey, updatedContract.id),
        updatedContract,
      );
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      setChangedCustomFieldCodes(new Set());
      setCustomFieldErrors({});
      setCustomFieldValues({});
      setCustomFieldMemberKeyword("");
      setCustomFieldEditorOpen(false);
    },
  });
  const ownerMemberQuery = useQuery({
    queryKey: ["member-selector", "contract-owner", identityKey, ownerMemberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Member selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: ownerMemberKeyword.trim() || undefined,
          }),
    enabled: apiClient !== null && ownerPickerOpen && canReadOrganization,
  });
  const ownerMutation = useMutation({
    mutationFn: ({ actorId, version }: { actorId: number; version: number }) =>
      apiClient === null || contractId === null
        ? Promise.reject(new Error("Contract owner update is unavailable."))
        : apiClient.updateContractOwner(contractId, { ownerActorId: actorId, version }),
    onSuccess: (updatedContract) => {
      queryClient.setQueryData(
        contractKeys.detail(identityKey, updatedContract.id),
        updatedContract,
      );
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      setOwnerPickerOpen(false);
      setOwnerMemberKeyword("");
    },
  });
  const collaboratorsQuery = useQuery({
    queryKey:
      contractId === null
        ? contractKeys.collaborators(identityKey, 0)
        : contractKeys.collaborators(identityKey, contractId),
    queryFn: () =>
      apiClient === null || contractId === null
        ? Promise.reject(new Error("Contract collaborators are unavailable."))
        : apiClient.getContractCollaboratorBaseline(contractId),
    enabled:
      apiClient !== null && contractId !== null && collaboratorPickerOpen && canManageCollaborators,
  });
  const productsBaselineQuery = useQuery({
    queryKey:
      contractId === null
        ? contractKeys.products(identityKey, 0)
        : contractKeys.products(identityKey, contractId),
    queryFn: () =>
      apiClient === null || contractId === null
        ? Promise.reject(new Error("Contract product baseline is unavailable."))
        : apiClient.getContractProductBaseline(contractId),
    enabled:
      apiClient !== null &&
      contractId !== null &&
      productPickerOpen &&
      canReadProducts &&
      canWriteContracts,
  });
  const productCandidateQuery = useQuery({
    queryKey: ["contract-product-replacement-selector", identityKey, productKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Contract product selection is unavailable."))
        : apiClient.getProducts({
            availability: "AVAILABLE",
            keyword: productKeyword.trim() || undefined,
            page: 1,
            size: 100,
          }),
    enabled: apiClient !== null && productPickerOpen && canReadProducts && canWriteContracts,
  });
  const collaboratorMemberQuery = useQuery({
    queryKey: [
      "member-selector",
      "contract-collaborators",
      identityKey,
      collaboratorMemberKeyword,
    ] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Member selection is unavailable."))
        : apiClient.getVisibleMembers({
            page: 1,
            size: 50,
            keyword: collaboratorMemberKeyword.trim() || undefined,
          }),
    enabled:
      apiClient !== null && collaboratorPickerOpen && canManageCollaborators && canReadOrganization,
  });
  const collaboratorMutation = useMutation({
    mutationFn: ({
      collaborators,
      version,
    }: {
      collaborators: readonly ContractCollaborator[];
      version: number;
    }) =>
      apiClient === null || contractId === null
        ? Promise.reject(new Error("Contract collaborator update is unavailable."))
        : apiClient.replaceContractCollaborators(contractId, {
            collaborators: [...collaborators],
            version,
          }),
    onSuccess: (updatedContract) => {
      queryClient.setQueryData(
        contractKeys.detail(identityKey, updatedContract.id),
        updatedContract,
      );
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      void queryClient.invalidateQueries({
        queryKey: contractKeys.collaborators(identityKey, updatedContract.id),
      });
      setCollaboratorPickerOpen(false);
      setCollaboratorMemberKeyword("");
      setCollaboratorDraft(null);
    },
  });
  const exitCollaboratorMutation = useMutation({
    mutationFn: (version: number) =>
      apiClient === null || contractId === null
        ? Promise.reject(new Error("Contract collaborator exit is unavailable."))
        : apiClient.exitContractCollaborator(contractId, version),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: contractKeys.detail(identityKey, contractId ?? 0),
      });
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      void queryClient.removeQueries({
        queryKey: contractKeys.collaborators(identityKey, contractId ?? 0),
      });
      closeDetail();
    },
  });
  const productMutation = useMutation({
    mutationFn: ({
      lines,
      version,
    }: {
      lines: readonly ContractProductDraftLine[];
      version: number;
    }) =>
      apiClient === null || contractId === null
        ? Promise.reject(new Error("Contract products update is unavailable."))
        : apiClient.replaceContractProducts(contractId, {
            lines: lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              ...(line.unitPrice === undefined ? {} : { unitPrice: line.unitPrice }),
            })),
            version,
          }),
    onSuccess: async (baseline) => {
      queryClient.setQueryData(contractKeys.products(identityKey, baseline.contractId), baseline);
      await queryClient.invalidateQueries({
        queryKey: contractKeys.detail(identityKey, baseline.contractId),
      });
      await queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
      setProductPickerOpen(false);
      setProductKeyword("");
      setProductDraft(null);
    },
  });

  function closeOwnerPicker() {
    if (ownerMutation.isPending) return;
    ownerMutation.reset();
    setOwnerPickerOpen(false);
    setOwnerMemberKeyword("");
  }

  function closeBasicEditor() {
    if (basicUpdateMutation.isPending) return;
    basicUpdateMutation.reset();
    setBasicEditorOpen(false);
    setEditedName("");
    setEditedNumber("");
  }

  function closeCustomFieldEditor() {
    if (customFieldUpdateMutation.isPending) return;
    customFieldUpdateMutation.reset();
    setChangedCustomFieldCodes(new Set());
    setCustomFieldErrors({});
    setCustomFieldValues({});
    setCustomFieldMemberKeyword("");
    setCustomFieldEditorOpen(false);
  }

  function closeCollaboratorPicker() {
    if (collaboratorMutation.isPending) return;
    collaboratorMutation.reset();
    setCollaboratorPickerOpen(false);
    setCollaboratorMemberKeyword("");
    setCollaboratorDraft(null);
  }

  function closeProductPicker() {
    if (productMutation.isPending) return;
    productMutation.reset();
    setProductPickerOpen(false);
    setProductKeyword("");
    setProductDraft(null);
  }

  if (contractId === null) return <StatusPage kind="not-found" />;

  let content: ReactNode;
  if (contractQuery.isLoading) {
    content = (
      <div
        aria-label="正在加载合同详情"
        style={{ display: "grid", minHeight: 240, placeItems: "center" }}
      >
        <Spin size="large" />
      </div>
    );
  } else if (contractQuery.isError) {
    content = (
      <StatusPage
        kind={statusKindFromError(contractQuery.error)}
        onRetry={() => void contractQuery.refetch()}
      />
    );
  } else {
    const contract = contractQuery.data;
    const collaborators = collaboratorDraft ?? collaboratorsQuery.data?.collaborators ?? [];
    const contractDynamicFields = serverProvidedDynamicFields(
      fieldDefinitionsQuery.data ?? [],
      contract?.customFields,
    );
    const collaboratorIds = new Set(collaborators.map((collaborator) => collaborator.actorId));
    const editableMemberOptions = (collaboratorMemberQuery.data ?? []).filter(
      (member) => member.actorId !== contract?.ownerActorId && !collaboratorIds.has(member.actorId),
    );
    const normalizedEditedName = editedName.trim();
    const normalizedEditedNumber = editedNumber.trim();
    const canEditBasics =
      contract !== undefined && contract.name !== null && contract.number !== null;
    const canSaveBasics =
      contract !== undefined &&
      canEditBasics &&
      normalizedEditedName.length > 0 &&
      normalizedEditedName.length <= 200 &&
      normalizedEditedNumber.length > 0 &&
      normalizedEditedNumber.length <= 100 &&
      (normalizedEditedName !== contract.name || normalizedEditedNumber !== contract.number);
    const replacementProducts = productDraft ?? productsBaselineQuery.data?.lines ?? [];
    const replacementProductIds = new Set(replacementProducts.map((product) => product.productId));
    const availableProductOptions = productCandidateQuery.data
      ? toPageResult(productCandidateQuery.data, toProductListItem).items.filter(
          (product) => !replacementProductIds.has(product.id),
        )
      : [];

    function editCollaborators(
      edit: (current: readonly ContractCollaborator[]) => readonly ContractCollaborator[],
    ) {
      setCollaboratorDraft((current) =>
        edit(current ?? collaboratorsQuery.data?.collaborators ?? []),
      );
    }

    function editContractProducts(
      edit: (current: readonly ContractProductDraftLine[]) => readonly ContractProductDraftLine[],
    ) {
      setProductDraft((current) => edit(current ?? productsBaselineQuery.data?.lines ?? []));
    }

    function updateContractProductQuantity(productId: number, value: number | null) {
      if (
        value === null ||
        !Number.isFinite(value) ||
        value <= 0 ||
        value > maximumContractProductInput
      ) {
        return;
      }
      editContractProducts((current) =>
        current.map((product) =>
          product.productId === productId ? { ...product, quantity: value } : product,
        ),
      );
    }

    function updateContractProductUnitPrice(productId: number, value: number | null) {
      if (
        value !== null &&
        (!Number.isFinite(value) || value < 0 || value > maximumContractProductInput)
      ) {
        return;
      }
      editContractProducts((current) =>
        current.map((product) =>
          product.productId === productId
            ? { ...product, ...(value === null ? { unitPrice: undefined } : { unitPrice: value }) }
            : product,
        ),
      );
    }

    content =
      contract === undefined || (customerId !== null && contract.customerId !== customerId) ? (
        <StatusPage kind="not-found" />
      ) : (
        <main className={styles.page}>
          <Button icon={<ArrowLeftOutlined />} onClick={closeDetail}>
            {onClose === undefined ? "返回客户合同" : "返回合同列表"}
          </Button>
          <section className={styles.heading}>
            <div>
              <div className={styles.titleRow}>
                <Typography.Title level={2}>
                  {contract.name || contract.number || `合同 ${contract.id}`}
                </Typography.Title>
                {contract.status ? <Tag>{contract.status}</Tag> : null}
              </div>
              <Typography.Text type="secondary">
                仅显示服务端返回的基础字段和产品快照；金额、折扣和协作者不进入本页。自定义字段仅展示服务端当前回显内容；字段附件仅在具备文件读取权限时按服务端投影认证下载。
              </Typography.Text>
            </div>
          </section>
          {deleteMutation.isError ||
          voidMutation.isError ||
          basicUpdateMutation.isError ||
          exitCollaboratorMutation.isError ? (
            <Alert
              title={
                deleteMutation.isError
                  ? deleteMutation.error instanceof ApiError
                    ? deleteMutation.error.message
                    : "合同暂时无法删除"
                  : voidMutation.isError
                    ? voidMutation.error instanceof ApiError
                      ? voidMutation.error.message
                      : "合同暂时无法作废"
                    : basicUpdateMutation.isError
                      ? basicUpdateMutation.error instanceof ApiError
                        ? basicUpdateMutation.error.message
                        : "合同基础信息暂时无法更新"
                      : exitCollaboratorMutation.error instanceof ApiError
                        ? exitCollaboratorMutation.error.message
                        : "暂时无法退出合同协作"
              }
              showIcon
              type="error"
            />
          ) : null}
          <Card title="基本信息">
            <Descriptions column={{ sm: 1, md: 2 }}>
              <Descriptions.Item label="合同编号">
                {displayValue(contract.number)}
              </Descriptions.Item>
              <Descriptions.Item label="客户">客户 {contract.customerId}</Descriptions.Item>
              <Descriptions.Item label="签约日期">
                {displayValue(contract.orderDate)}
              </Descriptions.Item>
              <Descriptions.Item label="开始日期">
                {displayValue(contract.startDate)}
              </Descriptions.Item>
              <Descriptions.Item label="结束日期">
                {displayValue(contract.endDate)}
              </Descriptions.Item>
              <Descriptions.Item label="合同类型">
                {displayValue(contract.contractType)}
              </Descriptions.Item>
              <Descriptions.Item label="付款方式">
                {displayValue(contract.paymentType)}
              </Descriptions.Item>
              <Descriptions.Item label="联系人">
                {displayReference("联系人", contract.contactId)}
              </Descriptions.Item>
              <Descriptions.Item label="负责人">
                {displayReference("成员", contract.ownerActorId)}
              </Descriptions.Item>
              <Descriptions.Item label="关联商机">
                {displayReference("商机", contract.opportunityId)}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {displayValue(contract.createdTime)}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {displayValue(contract.updatedTime)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          {canReadFieldMetadata && fieldDefinitionsQuery.isLoading ? (
            <Card title="自定义字段">
              <Spin aria-label="正在加载合同自定义字段目录" />
            </Card>
          ) : null}
          {canReadFieldMetadata && fieldDefinitionsQuery.isError ? (
            <Card title="自定义字段">
              <Alert title="合同自定义字段目录暂时无法加载" showIcon type="error" />
            </Card>
          ) : null}
          {contractDynamicFields.length > 0 ? (
            <Card title="自定义字段">
              <Typography.Paragraph type="secondary">
                值仅按服务端当前返回展示；不会作为编辑或字段权限判断的依据。
              </Typography.Paragraph>
              <ServerProvidedDynamicFieldDescriptions
                columns={{ sm: 1, xs: 1 }}
                definitions={fieldDefinitionsQuery.data ?? []}
                values={contract.customFields}
              />
            </Card>
          ) : null}
          <ControlledFileFieldDownloadCard
            canRead={canReadFileFields}
            fileFields={contract.fileFields}
            targetId={contract.id}
            targetType="contract"
            title="字段附件"
          />
          <ApprovalStartAction
            objectType="CONTRACT"
            subjectId={contract.id}
            onStarted={() => {
              void queryClient.invalidateQueries({
                queryKey: contractKeys.detail(identityKey, contract.id),
              });
              void queryClient.invalidateQueries({ queryKey: contractKeys.lists(identityKey) });
            }}
          />
          <ActionAuthority authority={authority.contractsAssign}>
            <ActionAuthority authority={authority.organizationRead}>
              <Button
                onClick={() => {
                  ownerMutation.reset();
                  setOwnerPickerOpen(true);
                }}
              >
                变更负责人
              </Button>
            </ActionAuthority>
            <Button
              onClick={() => {
                collaboratorMutation.reset();
                setCollaboratorPickerOpen(true);
              }}
            >
              管理协作者
            </Button>
          </ActionAuthority>
          <ActionAuthority authority={authority.contractsWrite}>
            <ActionAuthority authority={authority.productsRead}>
              <Button
                onClick={() => {
                  productMutation.reset();
                  setProductKeyword("");
                  setProductDraft(null);
                  setProductPickerOpen(true);
                }}
              >
                管理合同产品
              </Button>
            </ActionAuthority>
          </ActionAuthority>
          <RouteAuthority authority={authority.contractsWrite}>
            {canEditBasics ? (
              <Button
                onClick={() => {
                  basicUpdateMutation.reset();
                  setEditedName(contract.name ?? "");
                  setEditedNumber(contract.number ?? "");
                  setBasicEditorOpen(true);
                }}
              >
                编辑基本信息
              </Button>
            ) : null}
            <ActionAuthority authority={authority.fieldsRead}>
              {!fieldDefinitionsQuery.isError && customFormFieldDefinitions.length > 0 ? (
                <Button
                  onClick={() => {
                    customFieldUpdateMutation.reset();
                    setChangedCustomFieldCodes(new Set());
                    setCustomFieldErrors({});
                    setCustomFieldValues({});
                    setCustomFieldMemberKeyword("");
                    setCustomFieldEditorOpen(true);
                  }}
                >
                  编辑自定义字段
                </Button>
              ) : null}
            </ActionAuthority>
            <Popconfirm
              cancelText="取消"
              description="仅服务端确认当前成员为合同协作者时才会退出；负责人和其他成员不会由浏览器判断或修改。"
              okButtonProps={{ danger: true }}
              okText="确认退出"
              title="确认退出该合同协作？"
              onConfirm={() => exitCollaboratorMutation.mutate(contract.version)}
            >
              <Button danger loading={exitCollaboratorMutation.isPending}>
                退出协作
              </Button>
            </Popconfirm>
          </RouteAuthority>
          {canReadProducts ? (
            <Card title="合同产品">
              <List
                dataSource={[...contract.products]}
                locale={{ emptyText: "暂无可见合同产品" }}
                renderItem={(product) => {
                  const details = [
                    product.productCode === null ? null : `编码 ${product.productCode}`,
                    product.categoryName,
                    product.unit === null ? null : `单位 ${product.unit}`,
                    product.quantity === null ? null : `数量 ${product.quantity}`,
                  ].filter((value): value is string => value !== null);
                  return (
                    <List.Item>
                      <List.Item.Meta
                        description={details.length === 0 ? undefined : details.join(" · ")}
                        title={product.productName}
                      />
                    </List.Item>
                  );
                }}
              />
            </Card>
          ) : null}
          {contract.remark ? (
            <Card title="备注">
              <Typography.Paragraph className={styles.description}>
                {contract.remark}
              </Typography.Paragraph>
            </Card>
          ) : null}
          {contract.status === "ACTIVE" ? (
            <RouteAuthority authority={authority.contractsWrite}>
              <Popconfirm
                cancelText="取消"
                description="作废会由服务端复核当前合同状态、字段写入权限和并发版本。"
                okButtonProps={{ danger: true }}
                okText="确认作废"
                title="确认作废这份合同？"
                onConfirm={() => voidMutation.mutate(contract.version)}
              >
                <Button danger disabled={voidMutation.isPending} loading={voidMutation.isPending}>
                  作废合同
                </Button>
              </Popconfirm>
            </RouteAuthority>
          ) : null}
          <RouteAuthority authority={authority.contractsDelete}>
            <Popconfirm
              cancelText="取消"
              description="已有发票、回款或回款计划的合同不能删除；删除成功时服务端会撤回附件和文件字段绑定。"
              okButtonProps={{ danger: true }}
              okText="确认删除"
              title="确认删除这份合同？"
              onConfirm={() => deleteMutation.mutate(contract.version)}
            >
              <Button danger disabled={deleteMutation.isPending} loading={deleteMutation.isPending}>
                删除合同
              </Button>
            </Popconfirm>
          </RouteAuthority>
          <Modal
            destroyOnHidden
            footer={null}
            open={ownerPickerOpen}
            title="变更负责人"
            onCancel={closeOwnerPicker}
          >
            <Typography.Paragraph type="secondary">
              仅显示服务端允许当前成员查看的在职成员；最终可分配范围、字段权限和并发仍由服务端校验。
            </Typography.Paragraph>
            <Input.Search
              allowClear
              defaultValue={ownerMemberKeyword}
              placeholder="按成员姓名搜索"
              style={{ marginTop: 12 }}
              onSearch={(keyword) => setOwnerMemberKeyword(keyword)}
            />
            {ownerMemberQuery.isError ? (
              <Alert title="成员列表暂时无法加载" showIcon type="error" />
            ) : (
              <List
                dataSource={[...(ownerMemberQuery.data ?? [])]}
                loading={ownerMemberQuery.isLoading}
                locale={{ emptyText: "未找到可选择成员" }}
                renderItem={(member) => (
                  <List.Item
                    actions={[
                      <Button
                        disabled={
                          ownerMutation.isPending || member.actorId === contract.ownerActorId
                        }
                        key={member.actorId}
                        loading={ownerMutation.isPending}
                        type="link"
                        onClick={() =>
                          ownerMutation.mutate({
                            actorId: member.actorId,
                            version: contract.version,
                          })
                        }
                      >
                        {member.actorId === contract.ownerActorId ? "当前负责人" : "选择"}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      description={`成员 ${member.actorId}`}
                      title={member.displayName}
                    />
                  </List.Item>
                )}
              />
            )}
            {ownerMutation.isError ? (
              <Alert
                title={
                  ownerMutation.error instanceof ApiError
                    ? ownerMutation.error.message
                    : "合同负责人暂时无法更新"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
          </Modal>
          <Modal
            destroyOnHidden
            footer={
              <>
                <Button disabled={productMutation.isPending} onClick={closeProductPicker}>
                  取消
                </Button>
                <Button
                  disabled={
                    productDraft === null ||
                    productsBaselineQuery.isLoading ||
                    productsBaselineQuery.isError ||
                    productsBaselineQuery.data === undefined
                  }
                  loading={productMutation.isPending}
                  type="primary"
                  onClick={() => {
                    const baseline = productsBaselineQuery.data;
                    if (baseline === undefined) return;
                    productMutation.mutate({
                      lines: replacementProducts,
                      version: baseline.version,
                    });
                  }}
                >
                  保存合同产品
                </Button>
              </>
            }
            open={productPickerOpen}
            title="管理合同产品"
            onCancel={closeProductPicker}
          >
            <Typography.Paragraph type="secondary">
              产品清单仅从服务端完整、版本化快照读取。可修改数量和成交单价；新添产品的单价留空时系统采用当前目录价。折扣、行金额和合同总额始终由服务端计算，不会在此展示或由浏览器推算。
            </Typography.Paragraph>
            {productsBaselineQuery.isError ? (
              <Alert title="合同产品完整基线暂时无法加载" showIcon type="error" />
            ) : (
              <List
                dataSource={[...replacementProducts]}
                loading={productsBaselineQuery.isLoading}
                locale={{ emptyText: "暂未关联产品；可按合同需要保持空集合" }}
                renderItem={(product) => {
                  const details = [
                    `编码 ${product.productCode}`,
                    product.categoryName,
                    product.unit === null ? null : `单位 ${product.unit}`,
                  ].filter((value): value is string => value !== null);
                  return (
                    <List.Item
                      actions={[
                        <Button
                          danger
                          disabled={productMutation.isPending}
                          key={`remove-${product.productId}`}
                          type="link"
                          onClick={() =>
                            editContractProducts((current) =>
                              current.filter((item) => item.productId !== product.productId),
                            )
                          }
                        >
                          移除
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        description={details.join(" · ") || undefined}
                        title={product.productName}
                      />
                      <Space wrap>
                        <Typography.Text type="secondary">数量</Typography.Text>
                        <InputNumber
                          aria-label={`${product.productName} 数量`}
                          controls={false}
                          disabled={productMutation.isPending}
                          inputMode="decimal"
                          max={maximumContractProductInput}
                          min={0.0001}
                          precision={4}
                          value={product.quantity}
                          onChange={(value) =>
                            updateContractProductQuantity(product.productId, value)
                          }
                        />
                        <Typography.Text type="secondary">成交单价</Typography.Text>
                        <InputNumber
                          aria-label={`${product.productName} 成交单价`}
                          controls={false}
                          disabled={productMutation.isPending}
                          inputMode="decimal"
                          max={maximumContractProductInput}
                          min={0}
                          precision={2}
                          placeholder="按目录价"
                          value={product.unitPrice}
                          onChange={(value) =>
                            updateContractProductUnitPrice(product.productId, value)
                          }
                        />
                      </Space>
                    </List.Item>
                  );
                }}
              />
            )}
            <Typography.Title level={5}>添加产品</Typography.Title>
            <Input.Search
              allowClear
              aria-label="按产品名称或编码搜索"
              placeholder="按产品名称或编码搜索"
              value={productKeyword}
              onChange={(event) => setProductKeyword(event.target.value)}
            />
            {productCandidateQuery.isError ? (
              <Alert
                title="可添加产品暂时无法加载"
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : (
              <List
                dataSource={availableProductOptions}
                loading={productCandidateQuery.isLoading}
                locale={{ emptyText: "未找到可添加产品" }}
                renderItem={(product) => (
                  <List.Item
                    actions={[
                      <Button
                        disabled={
                          product.code === null ||
                          productMutation.isPending ||
                          productsBaselineQuery.isLoading ||
                          productsBaselineQuery.isError ||
                          productsBaselineQuery.data === undefined
                        }
                        key={product.id}
                        type="link"
                        onClick={() => {
                          const productCode = product.code;
                          if (productCode === null) return;
                          editContractProducts((current) => [
                            ...current,
                            {
                              categoryName: product.categoryName,
                              productCode,
                              productId: product.id,
                              productName: product.name,
                              quantity: 1,
                              unit: product.unit,
                            },
                          ]);
                        }}
                      >
                        {product.code === null ? "缺少可用编码" : "添加"}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      description={
                        [
                          product.code === null ? null : `编码 ${product.code}`,
                          product.categoryName,
                          product.unit === null ? null : `单位 ${product.unit}`,
                        ]
                          .filter((value): value is string => value !== null)
                          .join(" · ") || undefined
                      }
                      title={product.name}
                    />
                  </List.Item>
                )}
              />
            )}
            {productMutation.isError ? (
              <Alert
                title={
                  productMutation.error instanceof ApiError
                    ? productMutation.error.message
                    : "合同产品暂时无法更新"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
          </Modal>
          <Modal
            destroyOnHidden
            footer={
              <Space>
                <Button
                  disabled={customFieldUpdateMutation.isPending}
                  onClick={closeCustomFieldEditor}
                >
                  取消
                </Button>
                <Button
                  disabled={fieldDefinitionsQuery.isError || changedCustomFieldCodes.size === 0}
                  loading={customFieldUpdateMutation.isPending}
                  type="primary"
                  onClick={() => {
                    const customFieldIssues = validateCustomFieldFormValues(
                      customFieldDefinitions,
                      customFieldValues,
                    ).filter((issue) => changedCustomFieldCodes.has(issue.code));
                    setCustomFieldErrors(
                      Object.fromEntries(
                        customFieldIssues.map((issue) => [issue.code, issue.message]),
                      ),
                    );
                    if (customFieldIssues.length > 0) return;
                    customFieldUpdateMutation.mutate({
                      changedCodes: changedCustomFieldCodes,
                      values: customFieldValues,
                      version: contract.version,
                    });
                  }}
                >
                  保存修改
                </Button>
              </Space>
            }
            open={customFieldEditorOpen}
            title="编辑自定义字段"
            onCancel={closeCustomFieldEditor}
          >
            <Typography.Paragraph type="secondary">
              为避免把详情中的脱敏或只读值写回，字段均从空白开始。只有本次明确填写或清除的字段会提交；未操作字段由服务端保持当前值。
            </Typography.Paragraph>
            {fieldDefinitionsQuery.isError ? (
              <Alert title="合同自定义字段目录暂时无法加载" showIcon type="warning" />
            ) : (
              <Form layout="vertical">
                <CustomFieldFormFields
                  definitions={customFieldDefinitions}
                  departmentOptions={customFieldDepartmentQuery.data ?? []}
                  disabled={customFieldUpdateMutation.isPending}
                  errors={customFieldErrors}
                  memberOptions={customFieldMemberQuery.data ?? []}
                  memberOptionsLoading={customFieldMemberQuery.isLoading}
                  showExplicitClear
                  values={customFieldValues}
                  onChange={setCustomFieldValues}
                  onFieldChange={(code) => {
                    setChangedCustomFieldCodes((current) => new Set(current).add(code));
                    setCustomFieldErrors((current) => {
                      if (current[code] === undefined) return current;
                      return Object.fromEntries(
                        Object.entries(current).filter(([currentCode]) => currentCode !== code),
                      );
                    });
                  }}
                  onMemberSearch={setCustomFieldMemberKeyword}
                />
              </Form>
            )}
            {hasMemberCustomField && customFieldMemberQuery.isError ? (
              <Alert
                title="自定义人员字段候选暂时无法加载；请稍后重试后再修改该类字段"
                showIcon
                type="warning"
              />
            ) : null}
            {hasDepartmentCustomField && customFieldDepartmentQuery.isError ? (
              <Alert
                title="自定义部门字段候选暂时无法加载；请稍后重试后再修改该类字段"
                showIcon
                type="warning"
              />
            ) : null}
            {customFieldUpdateMutation.isError ? (
              <Alert
                title={
                  customFieldUpdateMutation.error instanceof ApiError
                    ? customFieldUpdateMutation.error.message
                    : "合同自定义字段暂时无法更新"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
          </Modal>
          <Modal
            destroyOnHidden
            footer={
              <>
                <Button disabled={basicUpdateMutation.isPending} onClick={closeBasicEditor}>
                  取消
                </Button>
                <Button
                  disabled={!canSaveBasics}
                  loading={basicUpdateMutation.isPending}
                  type="primary"
                  onClick={() => {
                    if (!canSaveBasics) return;
                    basicUpdateMutation.mutate({
                      name: normalizedEditedName,
                      number: normalizedEditedNumber,
                      originalName: contract.name ?? "",
                      originalNumber: contract.number ?? "",
                      version: contract.version,
                    });
                  }}
                >
                  保存修改
                </Button>
              </>
            }
            open={basicEditorOpen}
            title="编辑合同基本信息"
            onCancel={closeBasicEditor}
          >
            <Typography.Paragraph type="secondary">
              仅提交本次明确修改的合同名称、编号和当前
              version；客户、关联对象、产品、金额、折扣、动态字段和附件不会读取或写入。
            </Typography.Paragraph>
            <Typography.Text>合同名称</Typography.Text>
            <Input
              aria-label="合同名称"
              disabled={basicUpdateMutation.isPending}
              maxLength={200}
              style={{ marginTop: 8 }}
              value={editedName}
              onChange={(event) => setEditedName(event.target.value)}
            />
            <Typography.Text style={{ display: "block", marginTop: 16 }}>合同编号</Typography.Text>
            <Input
              aria-label="合同编号"
              disabled={basicUpdateMutation.isPending}
              maxLength={100}
              style={{ marginTop: 8 }}
              value={editedNumber}
              onChange={(event) => setEditedNumber(event.target.value)}
            />
            {basicUpdateMutation.isError ? (
              <Alert
                title={
                  basicUpdateMutation.error instanceof ApiError
                    ? basicUpdateMutation.error.message
                    : "合同基础信息暂时无法更新"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
          </Modal>
          <Modal
            destroyOnHidden
            footer={
              <>
                <Button disabled={collaboratorMutation.isPending} onClick={closeCollaboratorPicker}>
                  取消
                </Button>
                <Button
                  disabled={
                    collaboratorDraft === null ||
                    collaboratorsQuery.isLoading ||
                    collaboratorsQuery.isError ||
                    collaboratorsQuery.data === undefined
                  }
                  loading={collaboratorMutation.isPending}
                  type="primary"
                  onClick={() => {
                    const baseline = collaboratorsQuery.data;
                    if (baseline === undefined) return;
                    collaboratorMutation.mutate({ collaborators, version: baseline.version });
                  }}
                >
                  保存协作者
                </Button>
              </>
            }
            open={collaboratorPickerOpen}
            title="管理协作者"
            onCancel={closeCollaboratorPicker}
          >
            <Typography.Paragraph type="secondary">
              协作者清单只从服务端权威基线读取并完整替换。读取异常时不会允许保存；最终成员范围、读写权限和并发仍由服务端校验。
            </Typography.Paragraph>
            {collaboratorsQuery.isError ? (
              <Alert title="合同协作者暂时无法加载" showIcon type="error" />
            ) : (
              <List
                dataSource={[...collaborators]}
                loading={collaboratorsQuery.isLoading}
                locale={{ emptyText: "暂无协作者" }}
                renderItem={(collaborator) => (
                  <List.Item
                    actions={[
                      <Select<ContractCollaboratorAccess>
                        aria-label={`成员 ${collaborator.actorId} 的协作权限`}
                        disabled={collaboratorMutation.isPending}
                        key={`access-${collaborator.actorId}`}
                        options={[
                          { label: "只读", value: "READ" },
                          { label: "可编辑", value: "WRITE" },
                        ]}
                        value={collaborator.access}
                        onChange={(access) =>
                          editCollaborators((current) =>
                            current.map((item) =>
                              item.actorId === collaborator.actorId ? { ...item, access } : item,
                            ),
                          )
                        }
                      />,
                      <Button
                        danger
                        disabled={collaboratorMutation.isPending}
                        key={`remove-${collaborator.actorId}`}
                        type="link"
                        onClick={() =>
                          editCollaborators((current) =>
                            current.filter((item) => item.actorId !== collaborator.actorId),
                          )
                        }
                      >
                        移除
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      description={
                        collaborator.effectiveUntil === null
                          ? `成员 ${collaborator.actorId} · 有效时间不限`
                          : `成员 ${collaborator.actorId} · 截止到 ${collaborator.effectiveUntil}`
                      }
                      title={`成员 ${collaborator.actorId}`}
                    />
                  </List.Item>
                )}
              />
            )}
            {canReadOrganization ? (
              <>
                <Typography.Title level={5}>添加协作者</Typography.Title>
                <Input.Search
                  allowClear
                  defaultValue={collaboratorMemberKeyword}
                  placeholder="按成员姓名搜索"
                  onSearch={(keyword) => setCollaboratorMemberKeyword(keyword)}
                />
                {collaboratorMemberQuery.isError ? (
                  <Alert
                    title="成员列表暂时无法加载"
                    showIcon
                    style={{ marginTop: 12 }}
                    type="error"
                  />
                ) : (
                  <List
                    dataSource={editableMemberOptions}
                    loading={collaboratorMemberQuery.isLoading}
                    locale={{ emptyText: "未找到可添加成员" }}
                    renderItem={(member) => (
                      <List.Item
                        actions={[
                          <Button
                            disabled={collaboratorMutation.isPending}
                            key={member.actorId}
                            type="link"
                            onClick={() =>
                              editCollaborators((current) => [
                                ...current,
                                { actorId: member.actorId, access: "READ", effectiveUntil: null },
                              ])
                            }
                          >
                            添加为只读
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          description={`成员 ${member.actorId}`}
                          title={member.displayName}
                        />
                      </List.Item>
                    )}
                  />
                )}
              </>
            ) : (
              <Alert
                title="当前没有成员目录读取权限，无法新增协作者；仍可调整已加载的协作者权限。"
                showIcon
                style={{ marginTop: 12 }}
                type="info"
              />
            )}
            {collaboratorMutation.isError ? (
              <Alert
                title={
                  collaboratorMutation.error instanceof ApiError
                    ? collaboratorMutation.error.message
                    : "合同协作者暂时无法更新"
                }
                showIcon
                style={{ marginTop: 12 }}
                type="error"
              />
            ) : null}
          </Modal>
          <ActivityTimelineCard subjectId={contract.id} subjectType="CONTRACT" />
        </main>
      );
  }

  return (
    <RouteAuthority authority={authority.contractsRead}>
      <RouteAuthority authority={authority.customersRead}>{content}</RouteAuthority>
    </RouteAuthority>
  );
}
