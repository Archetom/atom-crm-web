import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import type { components } from "~/api/generated/schema";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import { StatusPage } from "~/components/feedback/status-page";
import {
  CreateFileFieldControls,
  CustomFieldFormFields,
  createFieldMetadataQueryKeys,
  customFileFieldDefinitions,
  customFieldFormDefinitions,
  toCustomFieldFormValues,
  unsupportedRequiredCustomFieldDefinitions,
  validateCustomFieldFormValues,
  type CreateFileFieldFiles,
  type CustomFieldValues,
} from "~/components/dynamic-field";

import { ReturnVisitOwnerSelect } from "../components/return-visit-owner-select";
import { toReturnVisitCreateRequest } from "../model/return-visit-form";
import {
  returnVisitFormOptions,
  returnVisitSatisfactionOptions,
  type ReturnVisitForm,
  type ReturnVisitSatisfaction,
} from "../model/return-visit-fields";
import {
  decodeReturnVisitRelationOptions,
  type ReturnVisitRelationKind,
  type ReturnVisitRelationOption,
} from "../model/return-visit-relation-option";
import { returnVisitKeys } from "../model/query-keys";

import styles from "./customer-return-visit-create-page.module.css";
import { parseRouteId } from "~/shared/utils/route-params";

interface ReturnVisitCreateFormValues {
  ownerActorId?: number;
  visitForm?: ReturnVisitForm;
  satisfaction?: ReturnVisitSatisfaction;
  remark?: string;
  visitTime?: Dayjs | null;
}

interface ReturnVisitCreateFileDraftState {
  draft: components["schemas"]["FileFieldDraftResponse"];
  filesByField: CreateFileFieldFiles;
}

export function CustomerReturnVisitCreatePage() {
  const { customerId: customerIdParam } = useParams();
  const customerId = parseRouteId(customerIdParam);
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identityKey = authState?.identityKey ?? "pending";
  const [createdReturnVisitId, setCreatedReturnVisitId] = useState<number | null>(null);
  const [relationPicker, setRelationPicker] = useState<ReturnVisitRelationKind | null>(null);
  const [relationKeyword, setRelationKeyword] = useState("");
  const [selectedContact, setSelectedContact] = useState<ReturnVisitRelationOption | null>(null);
  const [selectedContract, setSelectedContract] = useState<ReturnVisitRelationOption | null>(null);
  const canReadReturnVisits = hasAuthority(authorization, authority.returnVisitsRead);
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadContacts = hasAuthority(authorization, authority.contactsRead);
  const canReadContracts = hasAuthority(authorization, authority.contractsRead);
  const canReadCustomFieldMetadata = hasAuthority(authorization, authority.fieldsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const canWriteFiles = hasAuthority(authorization, authority.filesWrite);
  const customFieldDefinitionsQuery = useQuery({
    queryKey: createFieldMetadataQueryKeys(identityKey, "RETURN_VISIT", "fields:read").definitions,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回访字段目录暂时不可用。"))
        : apiClient.getFieldDefinitions("RETURN_VISIT"),
    enabled: apiClient !== null && canReadCustomFieldMetadata,
  });
  const customFieldDefinitions = customFieldDefinitionsQuery.data ?? [];
  const customFormFieldDefinitions = customFieldFormDefinitions(customFieldDefinitions);
  const customFileFields = customFileFieldDefinitions(customFieldDefinitions);
  const unsupportedRequiredCustomFields =
    unsupportedRequiredCustomFieldDefinitions(customFieldDefinitions);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [customFieldErrors, setCustomFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [fileFieldDraft, setFileFieldDraft] = useState<ReturnVisitCreateFileDraftState | null>(
    null,
  );
  const [fileFieldErrors, setFileFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [customFieldMemberKeyword, setCustomFieldMemberKeyword] = useState("");
  const hasMemberCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "USER",
  );
  const hasDepartmentCustomField = customFormFieldDefinitions.some(
    (field) => field.fieldType === "DEPARTMENT",
  );
  const customFieldMemberQuery = useQuery({
    queryKey: ["return-visit-custom-member", identityKey, customFieldMemberKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回访成员目录暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: customFieldMemberKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && canReadOrganization && hasMemberCustomField,
  });
  const customFieldDepartmentQuery = useQuery({
    queryKey: ["return-visit-custom-department", identityKey] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("回访部门目录暂时不可用。"))
        : apiClient.getVisibleDepartments(),
    enabled: apiClient !== null && canReadOrganization && hasDepartmentCustomField,
  });
  const unavailableRequiredCandidateFields = customFormFieldDefinitions.filter(
    (field) =>
      field.required &&
      (field.fieldType === "USER"
        ? !canReadOrganization ||
          customFieldMemberQuery.isLoading ||
          customFieldMemberQuery.isError ||
          (customFieldMemberQuery.data?.length ?? 0) === 0
        : field.fieldType === "DEPARTMENT"
          ? !canReadOrganization ||
            customFieldDepartmentQuery.isLoading ||
            customFieldDepartmentQuery.isError ||
            (customFieldDepartmentQuery.data?.length ?? 0) === 0
          : false),
  );
  const unavailableRequiredFileFields = customFileFields.filter(
    (field) => field.required && !canWriteFiles,
  );
  const relationCandidatesQuery = useQuery({
    queryKey: [
      "return-visit-create-relation-selector",
      identityKey,
      customerId,
      relationPicker,
      relationKeyword,
    ] as const,
    queryFn: () => {
      if (apiClient === null || customerId === null || relationPicker === null) {
        return Promise.reject(new Error("Return-visit relation selection is unavailable."));
      }
      const request = {
        customerId,
        keyword: relationKeyword.trim() || undefined,
        page: 1,
        size: 50,
      };
      return (
        relationPicker === "contact"
          ? apiClient.getContacts(request)
          : apiClient.getContracts(request)
      ).then((pager) => decodeReturnVisitRelationOptions(pager, customerId));
    },
    enabled:
      apiClient !== null &&
      customerId !== null &&
      relationPicker !== null &&
      canReadCustomers &&
      (relationPicker === "contact" ? canReadContacts : canReadContracts),
  });
  const createMutation = useMutation({
    mutationFn: (values: ReturnVisitCreateFormValues) => {
      if (
        apiClient === null ||
        customerId === null ||
        values.visitTime === null ||
        values.visitTime === undefined
      ) {
        return Promise.reject(new Error("Return visit creation is unavailable."));
      }
      return apiClient
        .createReturnVisit(
          toReturnVisitCreateRequest({
            customerId,
            contactId: selectedContact?.id,
            contractId: selectedContract?.id,
            customFields: toCustomFieldFormValues(customFieldDefinitions, customFieldValues),
            fileFieldSubmission:
              fileFieldDraft === null
                ? undefined
                : {
                    draftId: fileFieldDraft.draft.id,
                    fields: Object.fromEntries(
                      Object.entries(fileFieldDraft.filesByField).map(([code, files]) => [
                        code,
                        files.map((file) => file.fileId),
                      ]),
                    ),
                  },
            ownerActorId: values.ownerActorId,
            visitForm: values.visitForm,
            satisfaction: values.satisfaction,
            remark: values.remark,
            visitTime: values.visitTime.format("YYYY-MM-DDTHH:mm:ss"),
          }),
        )
        .then((returnVisit) => {
          if (returnVisit.customerId !== customerId) {
            throw new Error("Return-visit creation response does not match the current customer.");
          }
          return returnVisit;
        });
    },
    onSuccess: (returnVisit) => {
      queryClient.invalidateQueries({ queryKey: returnVisitKeys.lists(identityKey) });
      queryClient.setQueryData(returnVisitKeys.detail(identityKey, returnVisit.id), returnVisit);
      if (canReadReturnVisits) {
        navigate(`/crm/customers/${returnVisit.customerId}/return-visits/${returnVisit.id}`, {
          replace: true,
        });
      } else {
        setCreatedReturnVisitId(returnVisit.id);
      }
    },
  });
  const fileFieldUploadMutation = useMutation({
    mutationFn: async ({ fieldCode, files }: { fieldCode: string; files: readonly File[] }) => {
      if (apiClient === null) throw new Error("回访文件上传暂时不可用。");
      const draft =
        fileFieldDraft?.draft ?? (await apiClient.createCrmFileFieldDraft("RETURN_VISIT"));
      return {
        fieldCode,
        uploaded: await apiClient.uploadCrmFileFieldFiles(draft, fieldCode, files),
      };
    },
    onSuccess: ({ fieldCode, uploaded }) => {
      setFileFieldDraft((current) => {
        const existingFiles = current?.filesByField[fieldCode] ?? [];
        const knownIds = new Set(existingFiles.map((file) => file.fileId));
        return {
          draft: uploaded.draft,
          filesByField: {
            ...(current?.filesByField ?? {}),
            [fieldCode]: [
              ...existingFiles,
              ...uploaded.files.filter((file) => !knownIds.has(file.fileId)),
            ],
          },
        };
      });
      setFileFieldErrors((current) => {
        if (current[fieldCode] === undefined) return current;
        return Object.fromEntries(
          Object.entries(current).filter(([currentCode]) => currentCode !== fieldCode),
        );
      });
    },
  });

  function submit(values: ReturnVisitCreateFormValues) {
    const issues = validateCustomFieldFormValues(customFieldDefinitions, customFieldValues);
    setCustomFieldErrors(Object.fromEntries(issues.map((issue) => [issue.code, issue.message])));
    if (issues.length > 0) return;
    const missingFiles = Object.fromEntries(
      customFileFields.flatMap((field) =>
        field.required && (fileFieldDraft?.filesByField[field.code]?.length ?? 0) === 0
          ? [[field.code, `${field.displayName}为必填项`]]
          : [],
      ),
    );
    setFileFieldErrors(missingFiles);
    if (Object.keys(missingFiles).length > 0) return;
    if (values.visitTime === undefined || values.visitTime === null) return;
    createMutation.mutate(values);
  }

  function closeRelationPicker() {
    setRelationPicker(null);
    setRelationKeyword("");
  }

  function selectRelation(option: ReturnVisitRelationOption) {
    if (relationPicker === "contact") {
      setSelectedContact(option);
    } else if (relationPicker === "contract") {
      setSelectedContract(option);
    }
    closeRelationPicker();
  }

  if (customerId === null) return <StatusPage kind="not-found" />;

  return (
    <RouteAuthority authority={authority.returnVisitsWrite}>
      <main className={styles.page}>
        <section>
          <Button
            icon={<ArrowLeftOutlined />}
            type="link"
            onClick={() => navigate(`/crm/customers/${customerId}/return-visits`)}
          >
            返回客户回访
          </Button>
          <Typography.Title level={2}>新建回访</Typography.Title>
          <Typography.Text type="secondary">
            提交当前客户、回访时间、回访形式、可选联系人/合同、客户满意度和客户反馈；字段目录定义的动态字段和附件会按服务端规则提交。
          </Typography.Text>
        </section>
        {createMutation.isError ? (
          <Alert
            title={
              createMutation.error instanceof ApiError
                ? createMutation.error.message
                : "回访暂时无法创建"
            }
            showIcon
            type="error"
          />
        ) : null}
        {customFieldDefinitionsQuery.isError ? (
          <Alert title="回访自定义字段暂时无法加载" showIcon type="warning" />
        ) : null}
        {unsupportedRequiredCustomFields.length > 0 ? (
          <Alert title="存在尚未支持的必填自定义字段，暂不允许创建" showIcon type="error" />
        ) : null}
        {unavailableRequiredCandidateFields.length > 0 ? (
          <Alert
            title="必填自定义字段的成员或部门目录暂时不可用，暂不允许创建"
            showIcon
            type="error"
          />
        ) : null}
        {unavailableRequiredFileFields.length > 0 ? (
          <Alert title="必填自定义文件字段不可用，暂不允许创建" showIcon type="error" />
        ) : null}
        {fileFieldUploadMutation.isError ? (
          <Alert title="回访文件暂时无法上传" showIcon type="error" />
        ) : null}
        {createdReturnVisitId !== null ? (
          <Alert
            description="当前成员没有回访读取权限，无法自动打开详情；后续可见范围仍由服务端决定。"
            title={`回访已创建，编号 ${createdReturnVisitId}`}
            showIcon
            type="success"
          />
        ) : null}
        <Card title="基本信息">
          <Form initialValues={{ visitTime: dayjs() }} layout="vertical" onFinish={submit}>
            <Form.Item label="关联客户">
              <Typography.Text>客户 {customerId}</Typography.Text>
            </Form.Item>
            <Form.Item
              label="回访时间"
              name="visitTime"
              rules={[{ required: true, message: "请选择回访时间" }]}
            >
              <DatePicker
                aria-label="回访时间"
                className={styles.datePicker}
                disabled={createMutation.isPending}
                showTime
              />
            </Form.Item>
            <CustomFieldFormFields
              definitions={customFieldDefinitions}
              departmentOptions={customFieldDepartmentQuery.data ?? []}
              disabled={createMutation.isPending || fileFieldUploadMutation.isPending}
              errors={customFieldErrors}
              memberOptions={customFieldMemberQuery.data ?? []}
              memberOptionsLoading={customFieldMemberQuery.isLoading}
              values={customFieldValues}
              onChange={setCustomFieldValues}
              onFieldChange={(code) =>
                setCustomFieldErrors((current) =>
                  Object.fromEntries(Object.entries(current).filter(([key]) => key !== code)),
                )
              }
              onMemberSearch={setCustomFieldMemberKeyword}
            />
            <CreateFileFieldControls
              bindingObjectName="回访"
              definitions={customFieldDefinitions}
              disabled={createMutation.isPending || !canWriteFiles}
              errors={fileFieldErrors}
              filesByField={fileFieldDraft?.filesByField ?? {}}
              uploading={fileFieldUploadMutation.isPending}
              onRemove={(fieldCode, fileId) => {
                setFileFieldDraft((current) =>
                  current === null
                    ? null
                    : {
                        ...current,
                        filesByField: {
                          ...current.filesByField,
                          [fieldCode]: (current.filesByField[fieldCode] ?? []).filter(
                            (file) => file.fileId !== fileId,
                          ),
                        },
                      },
                );
                setFileFieldErrors((current) => {
                  if (current[fieldCode] === undefined) return current;
                  return Object.fromEntries(
                    Object.entries(current).filter(([currentCode]) => currentCode !== fieldCode),
                  );
                });
              }}
              onUpload={(fieldCode, files) => fileFieldUploadMutation.mutate({ fieldCode, files })}
            />
            <Form.Item label="回访形式" name="visitForm">
              <Select
                allowClear
                aria-label="回访形式"
                disabled={createMutation.isPending}
                options={returnVisitFormOptions}
                placeholder="请选择回访形式"
              />
            </Form.Item>
            <ReturnVisitOwnerSelect disabled={createMutation.isPending} />
            {canReadCustomers && canReadContacts ? (
              <Form.Item label="联系人">
                {selectedContact === null ? (
                  <Typography.Text type="secondary">未关联联系人</Typography.Text>
                ) : (
                  <Typography.Text>{selectedContact.name}</Typography.Text>
                )}
                <Space style={{ marginTop: 8 }}>
                  <Button
                    disabled={createMutation.isPending}
                    htmlType="button"
                    onClick={() => setRelationPicker("contact")}
                  >
                    选择联系人
                  </Button>
                  {selectedContact !== null ? (
                    <Button
                      disabled={createMutation.isPending}
                      htmlType="button"
                      onClick={() => setSelectedContact(null)}
                    >
                      清除选择
                    </Button>
                  ) : null}
                </Space>
              </Form.Item>
            ) : null}
            {canReadCustomers && canReadContracts ? (
              <Form.Item label="合同编号">
                {selectedContract === null ? (
                  <Typography.Text type="secondary">未关联合同</Typography.Text>
                ) : (
                  <Typography.Text>{selectedContract.name}</Typography.Text>
                )}
                <Space style={{ marginTop: 8 }}>
                  <Button
                    disabled={createMutation.isPending}
                    htmlType="button"
                    onClick={() => setRelationPicker("contract")}
                  >
                    选择合同
                  </Button>
                  {selectedContract !== null ? (
                    <Button
                      disabled={createMutation.isPending}
                      htmlType="button"
                      onClick={() => setSelectedContract(null)}
                    >
                      清除选择
                    </Button>
                  ) : null}
                </Space>
              </Form.Item>
            ) : null}
            <Form.Item label="客户满意度" name="satisfaction">
              <Select
                allowClear
                aria-label="客户满意度"
                disabled={createMutation.isPending}
                options={returnVisitSatisfactionOptions}
                placeholder="请选择客户满意度"
              />
            </Form.Item>
            <Form.Item
              label="客户反馈"
              name="remark"
              rules={[{ max: 2000, message: "备注不能超过 2000 个字符" }]}
            >
              <Input.TextArea
                aria-label="客户反馈"
                autoSize={{ minRows: 4, maxRows: 8 }}
                disabled={createMutation.isPending}
                maxLength={2000}
                placeholder="可选：记录客户反馈"
              />
            </Form.Item>
            <Typography.Paragraph type="secondary">
              服务端会重新校验客户可见性、可选关系归属、回访人可分配范围、回访字段写权限和默认负责人；浏览器不会补全联系人、合同或其他字段。
            </Typography.Paragraph>
            <Space>
              <Button
                disabled={createMutation.isPending}
                onClick={() => navigate(`/crm/customers/${customerId}/return-visits`)}
              >
                取消
              </Button>
              <Button
                disabled={
                  fileFieldUploadMutation.isPending ||
                  (canReadCustomFieldMetadata &&
                    (customFieldDefinitionsQuery.isLoading ||
                      customFieldDefinitionsQuery.isError)) ||
                  unsupportedRequiredCustomFields.length > 0 ||
                  unavailableRequiredCandidateFields.length > 0 ||
                  unavailableRequiredFileFields.length > 0
                }
                htmlType="submit"
                loading={createMutation.isPending}
                type="primary"
              >
                创建回访
              </Button>
            </Space>
          </Form>
        </Card>
        <Modal
          destroyOnHidden
          footer={null}
          open={relationPicker !== null}
          title={relationPicker === "contact" ? "选择联系人" : "选择合同"}
          onCancel={closeRelationPicker}
        >
          <Typography.Paragraph type="secondary">
            仅显示服务端允许查看且明确属于当前客户的候选项；不能手动输入关联 ID。
          </Typography.Paragraph>
          <Input.Search
            allowClear
            defaultValue={relationKeyword}
            key={relationPicker}
            placeholder={relationPicker === "contact" ? "按联系人姓名搜索" : "按合同名称或编号搜索"}
            onSearch={(keyword) => setRelationKeyword(keyword)}
          />
          {relationCandidatesQuery.isError ? (
            <Alert
              title={
                relationPicker === "contact" ? "联系人列表暂时无法加载" : "合同列表暂时无法加载"
              }
              showIcon
              style={{ marginTop: 12 }}
              type="error"
            />
          ) : (
            <List
              dataSource={[...(relationCandidatesQuery.data ?? [])]}
              loading={relationCandidatesQuery.isLoading}
              locale={{ emptyText: "未找到可选择项" }}
              renderItem={(option) => (
                <List.Item
                  actions={[
                    <Button
                      disabled={createMutation.isPending}
                      key={option.id}
                      type="link"
                      onClick={() => selectRelation(option)}
                    >
                      选择
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    description={`${relationPicker === "contact" ? "联系人" : "合同"} ${option.id}`}
                    title={option.name}
                  />
                </List.Item>
              )}
            />
          )}
        </Modal>
      </main>
    </RouteAuthority>
  );
}
