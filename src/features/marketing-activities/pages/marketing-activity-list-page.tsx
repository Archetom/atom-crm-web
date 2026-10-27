import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
  message,
  type TableProps,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { components } from "~/api/generated/schema";
import type { MarketingActivityImageType } from "~/api/client/api-client";
import { saveControlledDownload } from "~/api/client/controlled-download";
import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { ActionAuthority } from "~/app/permissions/action-authority";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import type { PageResult } from "~/components/data-view/pagination";
import { ResponsiveDataList } from "~/components/data-view/responsive-data-list";
import { DataWorkspace } from "~/components/page/data-workspace";
import { FilterBar } from "~/components/page/filter-bar";
import { PageHeader } from "~/components/page/page-header";
import { marketingKeys } from "~/features/marketing";
import { organizationKeys } from "~/features/organization";

import {
  relatedObjectTypeLabel,
  marketingActivityDefaultPageRequest,
  marketingActivityPageRequestFromSearch,
  toMarketingActivityCreateRequest,
  toMarketingActivityDraft,
  toMarketingActivityPage,
  toMarketingActivityUpdateRequest,
  supportsMarketingForm,
  type MarketingActivity,
  type MarketingActivityDraft,
  type RelatedObjectType,
  type RelatedObjectTypeOption,
} from "../model/marketing-activity";
import { selectedMarketingActivityIdFromSearch } from "../model/marketing-activity-route";
import { marketingActivityKeys } from "../model/query-keys";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatDateTime(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm") : "—";
}

function formatBudget(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
}

function formatFileSize(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return "大小未提供";
  }
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentUploadFeedback(
  results: readonly { status: components["schemas"]["AttachmentUploadStatusResponse"] }[],
): void {
  const statuses = results.map((result) => result.status.status);
  if (statuses.includes("REJECTED")) {
    message.warning("附件已上传，但有文件未通过安全检查。请重新选择文件后重试。");
  } else if (
    statuses.some((status) => status === "ACCEPTED_FOR_INSPECTION" || status === "UPLOADING")
  ) {
    message.success("附件已上传，正在进行安全检查；通过后才会显示并可下载。");
  } else if (statuses.every((status) => status === "AVAILABLE")) {
    message.success("附件已上传并可下载。");
  } else {
    message.info("附件已提交，请稍后刷新附件列表查看状态。");
  }
}

function relatedObjectTypeFromSearch(
  value: string | null,
  relatedObjectTypes: readonly RelatedObjectTypeOption[],
): RelatedObjectType | undefined {
  return relatedObjectTypes.find((candidate) => candidate.code === value)?.code;
}

function searchWith(
  current: URLSearchParams,
  changes: Record<string, number | string | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

interface ActivityEditorProps {
  actorId: number | undefined;
  canCreateMarketingForms: boolean;
  canReadMarketingForms: boolean;
  canReadOrganization: boolean;
  departments: readonly components["schemas"]["DepartmentResponse"][];
  form: ReturnType<typeof Form.useForm<MarketingActivityDraft>>[0];
  initialValues: MarketingActivityDraft;
  memberKeyword: string;
  members: readonly { actorId: number; displayName: string }[];
  marketingForms: readonly components["schemas"]["MarketingFormResponse"][];
  marketingFormsLoading: boolean;
  marketingFormConfiguration:
    components["schemas"]["MarketingFormConfigurationOptionsResponse"] | undefined;
  marketingFormConfigurationLoading: boolean;
  activityConfiguration:
    components["schemas"]["MarketingActivityConfigurationOptionsResponse"] | undefined;
  activityConfigurationLoading: boolean;
  defaultRelatedObjectType: RelatedObjectType | undefined;
  relatedObjectTypes: readonly RelatedObjectTypeOption[];
  onCancel(): void;
  onMemberSearch(keyword: string): void;
  onSubmit(draft: MarketingActivityDraft): void;
  open: boolean;
  source: MarketingActivity | null;
  submitting: boolean;
}

function ActivityEditor({
  actorId,
  canCreateMarketingForms,
  canReadMarketingForms,
  canReadOrganization,
  departments,
  form,
  initialValues,
  memberKeyword,
  members,
  marketingForms,
  marketingFormsLoading,
  marketingFormConfiguration,
  marketingFormConfigurationLoading,
  activityConfiguration,
  activityConfigurationLoading,
  defaultRelatedObjectType,
  relatedObjectTypes,
  onCancel,
  onMemberSearch,
  onSubmit,
  open,
  source,
  submitting,
}: Readonly<ActivityEditorProps>) {
  const marketingFormMode = Form.useWatch("marketingFormMode", form);
  const relatedObjectType = Form.useWatch("relatedObjectType", form);
  const createsMarketingForm = source === null && marketingFormMode === "CREATE";
  useEffect(() => {
    if (
      source === null &&
      relatedObjectType === undefined &&
      defaultRelatedObjectType !== undefined
    ) {
      form.setFieldValue("relatedObjectType", defaultRelatedObjectType);
    }
  }, [defaultRelatedObjectType, form, relatedObjectType, source]);
  const memberOptions = useMemo(() => {
    const values =
      actorId === undefined
        ? members
        : [{ actorId, displayName: `当前成员 #${actorId}` }, ...members];
    return values.filter(
      (member, index) =>
        values.findIndex((candidate) => candidate.actorId === member.actorId) === index,
    );
  }, [actorId, members]);
  const marketingFormOptions = useMemo(() => {
    const options = marketingForms
      .filter(
        (marketingForm) =>
          marketingForm.status !== "DELETED" &&
          relatedObjectType !== undefined &&
          supportsMarketingForm(relatedObjectType, relatedObjectTypes) &&
          marketingForm.targetObjectType === relatedObjectType,
      )
      .map((marketingForm) => ({
        label: `${marketingForm.name}（${marketingForm.status === "ACTIVE" ? "已启用" : "未启用"}）`,
        value: marketingForm.id,
      }));
    if (
      initialValues.marketingFormId !== undefined &&
      !options.some((option) => option.value === initialValues.marketingFormId)
    ) {
      options.push({
        label: `已关联表单 #${initialValues.marketingFormId}`,
        value: initialValues.marketingFormId,
      });
    }
    return options;
  }, [initialValues.marketingFormId, marketingForms, relatedObjectType, relatedObjectTypes]);
  const activityTypeOptions = useMemo(() => {
    const options: { label: string; value: string }[] =
      activityConfiguration?.activityTypes.map((type) => ({
        label: type.displayName,
        value: type.code,
      })) ?? [];
    const legacyType = source?.activityType?.trim();
    if (legacyType && !options.some((option) => option.value === legacyType)) {
      options.push({ label: `历史类型：${legacyType}`, value: legacyType });
    }
    return options;
  }, [activityConfiguration?.activityTypes, source?.activityType]);

  return (
    <Modal
      destroyOnHidden
      footer={null}
      onCancel={onCancel}
      open={open}
      title={source === null ? "新建市场活动" : "编辑市场活动"}
      width={720}
    >
      <Form<MarketingActivityDraft>
        form={form}
        initialValues={initialValues}
        layout="vertical"
        onFinish={onSubmit}
        preserve={false}
      >
        <Form.Item
          label="活动名称"
          name="name"
          rules={[{ required: true, message: "请输入活动名称" }]}
        >
          <Input maxLength={200} placeholder="请输入活动名称" />
        </Form.Item>
        <Form.Item
          label="关联对象"
          name="relatedObjectType"
          rules={[{ required: true, message: "请选择关联对象" }]}
        >
          <Select
            onChange={(value: RelatedObjectType) => {
              if (source === null) {
                form.setFieldsValue({
                  marketingForm: undefined,
                  marketingFormId: undefined,
                  ...(supportsMarketingForm(value, relatedObjectTypes)
                    ? {}
                    : { marketingFormMode: "EXISTING" }),
                });
              }
            }}
            disabled={activityConfiguration === undefined}
            loading={activityConfigurationLoading}
            notFoundContent={
              activityConfiguration === undefined ? "关联对象目录暂时不可用" : "没有可选关联对象"
            }
            options={relatedObjectTypes.map((option) => ({
              label: option.displayName,
              value: option.code,
            }))}
          />
        </Form.Item>
        {source === null ? (
          <Form.Item
            extra={
              activityConfiguration === undefined
                ? "关联对象目录暂时不可用；为避免写入未受控的对象或表单能力，不能保存活动。"
                : relatedObjectType !== undefined &&
                    supportsMarketingForm(relatedObjectType, relatedObjectTypes)
                  ? `可关联已有${relatedObjectTypeLabel(relatedObjectType, relatedObjectTypes)}表单，或随活动原子创建一份未启用的${relatedObjectTypeLabel(relatedObjectType, relatedObjectTypes)}采集表单。`
                  : "当前关联对象不支持公开表单。"
            }
            label="公开表单方式"
            name="marketingFormMode"
          >
            <Radio.Group
              onChange={(event) => {
                if (event.target.value === "CREATE") {
                  form.setFieldValue("marketingFormId", undefined);
                } else {
                  form.setFieldValue("marketingForm", undefined);
                }
              }}
            >
              <Radio disabled={!canReadMarketingForms} value="EXISTING">
                关联已有表单
              </Radio>
              <Radio
                disabled={
                  !canCreateMarketingForms ||
                  relatedObjectType === undefined ||
                  !supportsMarketingForm(relatedObjectType, relatedObjectTypes)
                }
                value="CREATE"
              >
                创建
                {relatedObjectType === undefined
                  ? ""
                  : relatedObjectTypeLabel(relatedObjectType, relatedObjectTypes)}
                采集表单
              </Radio>
            </Radio.Group>
          </Form.Item>
        ) : null}
        {!createsMarketingForm ? (
          <Form.Item
            extra={
              canReadMarketingForms
                ? "可选关联既有营销表单。表单启用后，活动详情会显示真实公开链接；字段配置和启用状态请在营销表单中完成。"
                : "当前身份无营销表单目录读取权限，不能新增或修改表单关联。"
            }
            label="公开表单"
            name="marketingFormId"
          >
            <Select
              allowClear
              disabled={!canReadMarketingForms}
              loading={marketingFormsLoading}
              notFoundContent={
                canReadMarketingForms ? "没有可关联的营销表单" : "营销表单目录不可用"
              }
              options={marketingFormOptions}
              placeholder="选择已配置的营销表单（可选）"
            />
          </Form.Item>
        ) : (
          <Card
            size="small"
            title={`新建${
              relatedObjectType !== undefined &&
              supportsMarketingForm(relatedObjectType, relatedObjectTypes)
                ? relatedObjectTypeLabel(relatedObjectType, relatedObjectTypes)
                : ""
            }采集表单`}
          >
            <Alert
              description="保存活动时会一并创建一份未启用的表单；字段显示名采用当前服务端字段目录。保存后可在营销表单中继续调整显示细节并启用公开访问。"
              title={`仅收集${
                relatedObjectType !== undefined &&
                supportsMarketingForm(relatedObjectType, relatedObjectTypes)
                  ? relatedObjectTypeLabel(relatedObjectType, relatedObjectTypes)
                  : "目标"
              }字段`}
              showIcon
              type="info"
            />
            <Form.Item
              label="表单内部名称"
              name={["marketingForm", "name"]}
              rules={[{ required: true, message: "请输入表单内部名称" }]}
              style={{ marginTop: 16 }}
            >
              <Input maxLength={200} placeholder="例如：秋季活动线索收集" />
            </Form.Item>
            <Form.Item
              label="公开标题"
              name={["marketingForm", "title"]}
              rules={[{ required: true, message: "请输入公开表单标题" }]}
            >
              <Input maxLength={200} placeholder="例如：报名秋季活动" />
            </Form.Item>
            <Form.Item label="表单说明" name={["marketingForm", "description"]}>
              <Input.TextArea maxLength={4000} rows={2} />
            </Form.Item>
            <Form.Item label="提交按钮文字" name={["marketingForm", "submitButtonText"]}>
              <Input maxLength={100} placeholder="提交" />
            </Form.Item>
            <Form.Item label="提交成功提示" name={["marketingForm", "successMessage"]}>
              <Input.TextArea maxLength={1000} rows={2} />
            </Form.Item>
            <Form.Item
              extra="字段选项只来自当前身份可配置的目标字段目录。"
              label="公开收集字段"
              name={["marketingForm", "fieldCodes"]}
              rules={[{ required: true, message: "请至少选择一个公开收集字段" }]}
            >
              <Select
                disabled={marketingFormConfiguration === undefined}
                loading={marketingFormConfigurationLoading}
                mode="multiple"
                notFoundContent={
                  marketingFormConfiguration === undefined
                    ? "目标字段目录暂时不可用"
                    : "没有可配置的目标字段"
                }
                options={marketingFormConfiguration?.fields.map((field) => ({
                  label: `${field.displayName}（${field.fieldType}）`,
                  value: field.fieldCode,
                }))}
                placeholder="选择公开收集的目标字段"
              />
            </Form.Item>
          </Card>
        )}
        <Form.Item
          dependencies={["participantDepartmentIds"]}
          extra={
            canReadOrganization
              ? "成员候选来自服务端可见且处于活动状态的成员目录。"
              : "当前身份无成员目录读取权限，仅可保留当前成员作为参与人员。"
          }
          label="参与人员"
          name="participantActorIds"
          rules={[
            {
              validator: async (_, value: readonly number[] | undefined) => {
                const participantDepartmentIds = form.getFieldValue("participantDepartmentIds") as
                  readonly number[] | undefined;
                if ((value?.length ?? 0) + (participantDepartmentIds?.length ?? 0) === 0) {
                  throw new Error("请至少选择一位参与人员或一个参与部门");
                }
              },
            },
          ]}
        >
          <Select
            disabled={!canReadOrganization && actorId === undefined}
            filterOption={false}
            mode="multiple"
            notFoundContent={canReadOrganization ? "没有可选成员" : "成员目录不可用"}
            options={memberOptions.map((member) => ({
              label: member.displayName,
              value: member.actorId,
            }))}
            placeholder="搜索并选择参与人员"
            searchValue={memberKeyword}
            onSearch={onMemberSearch}
          />
        </Form.Item>
        <Form.Item
          extra={
            canReadOrganization
              ? "部门以服务端目录中的原始组织单元保存，不会在浏览器中展开为成员。"
              : "当前身份无部门目录读取权限。"
          }
          label="参与部门"
          name="participantDepartmentIds"
        >
          <Select
            disabled={!canReadOrganization}
            mode="multiple"
            notFoundContent={canReadOrganization ? "没有可选部门" : "部门目录不可用"}
            options={departments
              .filter((department) => department.active)
              .map((department) => ({ label: department.name, value: department.id }))}
            placeholder="选择参与部门"
          />
        </Form.Item>
        <Form.Item
          label="活动时间"
          name="timeRange"
          rules={[{ required: true, message: "请选择开始和截止时间" }]}
        >
          <DatePicker.RangePicker allowClear={false} showTime style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          extra={
            activityConfiguration === undefined
              ? "活动类型目录暂时不可用；为避免写入未受控的类型，不能更改该字段。"
              : "活动类型只可从服务端发布的目录选择。"
          }
          label="活动类型"
          name="activityType"
        >
          <Select
            allowClear
            disabled={activityConfiguration === undefined}
            loading={activityConfigurationLoading}
            notFoundContent={
              activityConfiguration === undefined ? "活动类型目录暂时不可用" : "没有可选活动类型"
            }
            options={activityTypeOptions}
            placeholder="选择活动类型（可选）"
          />
        </Form.Item>
        <Form.Item
          label="浏览数"
          name="viewCount"
          rules={[{ required: true, message: "请输入浏览数" }]}
        >
          <InputNumber
            max={Number.MAX_SAFE_INTEGER}
            min={0}
            precision={0}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <Form.Item
          label="提交数"
          name="submissionCount"
          rules={[{ required: true, message: "请输入提交数" }]}
        >
          <InputNumber
            max={Number.MAX_SAFE_INTEGER}
            min={0}
            precision={0}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <Form.Item label="活动预算" name="budget">
          <InputNumber min={0} precision={2} prefix="¥" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="活动地址" name="address">
          <Input maxLength={300} />
        </Form.Item>
        <Form.Item label="活动简介" name="description">
          <Input.TextArea maxLength={2000} rows={4} />
        </Form.Item>
        <Form.Item name="oneSubmissionPerUser" valuePropName="checked">
          <Checkbox>每个用户仅可提交一次</Checkbox>
        </Form.Item>
        <Space>
          <Button
            disabled={activityConfiguration === undefined}
            htmlType="submit"
            loading={submitting}
            type="primary"
          >
            保存
          </Button>
          <Button onClick={onCancel}>取消</Button>
        </Space>
      </Form>
    </Modal>
  );
}

export function MarketingActivityListPage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editorSource, setEditorSource] = useState<MarketingActivity | null | undefined>(undefined);
  const [memberKeyword, setMemberKeyword] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<MarketingActivity[]>([]);
  const [form] = Form.useForm<MarketingActivityDraft>();
  const editorRelatedObjectType = Form.useWatch("relatedObjectType", form);
  const identityKey = authState?.identityKey ?? "pending";
  const canWrite = hasAuthority(authorization, authority.marketingActivitiesWrite);
  const canDelete = hasAuthority(authorization, authority.marketingActivitiesDelete);
  const canReadAttachments =
    hasAuthority(authorization, authority.marketingActivitiesRead) &&
    hasAuthority(authorization, authority.filesRead);
  const canWriteAttachments = canWrite && hasAuthority(authorization, authority.filesWrite);
  const canCreateMarketingForms = hasAuthority(authorization, authority.marketingFormsWrite);
  const canReadMarketingForms = hasAuthority(authorization, authority.marketingFormsRead);
  const canReadOrganization = hasAuthority(authorization, authority.organizationRead);
  const activityConfigurationQuery = useQuery({
    queryKey: marketingActivityKeys.configuration(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("市场活动配置暂时不可用。"))
        : apiClient.getMarketingActivityConfigurationOptions(),
    enabled: apiClient !== null,
  });
  const relatedObjectTypes = activityConfigurationQuery.data?.relatedObjectTypes ?? [];
  const defaultRelatedObjectType = activityConfigurationQuery.data?.defaultRelatedObjectType;
  const page = useMemo(() => marketingActivityPageRequestFromSearch(searchParams), [searchParams]);
  const currentRelatedObjectType = relatedObjectTypeFromSearch(
    searchParams.get("relatedObjectType"),
    relatedObjectTypes,
  );
  const openCreateFromSearch = searchParams.get("create") === "1";
  const creatingActivity =
    editorSource === null || (editorSource === undefined && openCreateFromSearch);
  const inlineMarketingFormTarget =
    editorRelatedObjectType !== undefined &&
    supportsMarketingForm(editorRelatedObjectType, relatedObjectTypes)
      ? editorRelatedObjectType
      : undefined;
  const selectedActivityId = selectedMarketingActivityIdFromSearch(searchParams.toString());
  const request = useMemo<components["schemas"]["MarketingActivityQueryRequest"]>(
    () => ({
      keyword: searchParams.get("keyword")?.trim() || undefined,
      page: page.page,
      relatedObjectType: currentRelatedObjectType,
      size: page.size,
    }),
    [currentRelatedObjectType, page.page, page.size, searchParams],
  );
  const activitiesQuery = useQuery({
    queryKey: marketingActivityKeys.list(identityKey, request),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("市场活动暂时无法加载。"))
        : apiClient.getMarketingActivities(request),
    enabled: apiClient !== null,
  });
  const selectedActivityQuery = useQuery({
    queryKey: marketingActivityKeys.detail(identityKey, selectedActivityId ?? 0),
    queryFn: () =>
      apiClient === null || selectedActivityId === null
        ? Promise.reject(new Error("市场活动详情暂时不可用。"))
        : apiClient.getMarketingActivity(selectedActivityId),
    enabled: apiClient !== null && selectedActivityId !== null,
  });
  const selected = selectedActivityQuery.data;
  const memberQuery = useQuery({
    queryKey: marketingActivityKeys.members(identityKey, memberKeyword),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("成员选择暂时不可用。"))
        : apiClient.getVisibleMembers({
            keyword: memberKeyword.trim() || undefined,
            page: 1,
            size: 100,
          }),
    enabled:
      apiClient !== null &&
      (editorSource !== undefined || openCreateFromSearch) &&
      canWrite &&
      canReadOrganization,
  });
  const departmentsQuery = useQuery({
    queryKey: organizationKeys.departments(identityKey),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("部门目录暂时不可用。"))
        : apiClient.getOrganizationDepartments(),
    enabled:
      apiClient !== null &&
      canReadOrganization &&
      (editorSource !== undefined || openCreateFromSearch || selectedActivityId !== null),
  });
  const marketingFormsQuery = useQuery({
    queryKey: marketingKeys.forms(identityKey, 1, 200),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("营销表单目录暂时不可用。"))
        : apiClient.getMarketingForms({ page: 1, size: 200 }),
    enabled:
      apiClient !== null &&
      canReadMarketingForms &&
      (editorSource !== undefined || openCreateFromSearch),
  });
  const marketingFormConfigurationQuery = useQuery({
    queryKey: marketingKeys.configuration(identityKey, undefined, inlineMarketingFormTarget),
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("目标字段目录暂时不可用。"))
        : apiClient.getMarketingFormConfigurationOptions(undefined, inlineMarketingFormTarget),
    enabled:
      apiClient !== null &&
      canCreateMarketingForms &&
      creatingActivity &&
      inlineMarketingFormTarget !== undefined,
  });
  const activityTypeLabels = useMemo(
    () =>
      new Map<string, string>(
        activityConfigurationQuery.data?.activityTypes.map((type) => [type.code, type.displayName]),
      ),
    [activityConfigurationQuery.data?.activityTypes],
  );
  const coverImageQuery = useQuery({
    queryKey: marketingActivityKeys.attachmentList(identityKey, selected?.id ?? 0, "COVER"),
    queryFn: () =>
      apiClient === null || selected === undefined
        ? Promise.reject(new Error("市场活动图片暂时无法加载。"))
        : apiClient.getAttachments(
            { targetId: selected.id, targetType: "marketing-activity" },
            { marketingActivityImageType: "COVER", page: 1, size: 9 },
          ),
    enabled: apiClient !== null && selected !== undefined && canReadAttachments,
  });
  const detailImageQuery = useQuery({
    queryKey: marketingActivityKeys.attachmentList(identityKey, selected?.id ?? 0, "DETAIL"),
    queryFn: () =>
      apiClient === null || selected === undefined
        ? Promise.reject(new Error("市场活动图片暂时无法加载。"))
        : apiClient.getAttachments(
            { targetId: selected.id, targetType: "marketing-activity" },
            { marketingActivityImageType: "DETAIL", page: 1, size: 9 },
          ),
    enabled: apiClient !== null && selected !== undefined && canReadAttachments,
  });
  const saveMutation = useMutation({
    mutationFn: ({
      draft,
      source,
    }: {
      draft: MarketingActivityDraft;
      source: MarketingActivity | null;
    }) => {
      if (apiClient === null) return Promise.reject(new Error("市场活动暂时无法保存。"));
      return source === null
        ? apiClient.createMarketingActivity(
            toMarketingActivityCreateRequest(
              draft,
              marketingFormConfigurationQuery.data,
              draft.relatedObjectType !== undefined &&
                supportsMarketingForm(draft.relatedObjectType, relatedObjectTypes),
            ),
          )
        : apiClient.updateMarketingActivity(
            source.id,
            toMarketingActivityUpdateRequest(draft, source),
          );
    },
    onSuccess: (activity, { draft, source }) => {
      message.success(
        source === null && draft.marketingFormMode === "CREATE"
          ? `市场活动和${
              draft.relatedObjectType === undefined
                ? "目标"
                : relatedObjectTypeLabel(draft.relatedObjectType, relatedObjectTypes)
            }采集表单已创建`
          : source === null
            ? "市场活动已创建"
            : "市场活动已更新",
      );
      if (source !== null) {
        queryClient.setQueryData(marketingActivityKeys.detail(identityKey, activity.id), activity);
      }
      setSelectedActivities([]);
      setEditorSource(undefined);
      if (source === null && openCreateFromSearch) {
        setSearchParams(searchWith(searchParams, { create: undefined }));
      }
      void queryClient.invalidateQueries({ queryKey: marketingActivityKeys.all });
      if (source === null && draft.marketingFormMode === "CREATE") {
        void queryClient.invalidateQueries({ queryKey: marketingKeys.all });
      }
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (activity: MarketingActivity) => {
      if (apiClient === null) return Promise.reject(new Error("市场活动暂时无法删除。"));
      return apiClient.deleteMarketingActivity(activity.id, activity.version);
    },
    onSuccess: () => {
      message.success("市场活动已删除");
      setSelectedActivities([]);
      closeDetail();
      void queryClient.invalidateQueries({ queryKey: marketingActivityKeys.all });
    },
  });
  const batchDeleteMutation = useMutation({
    mutationFn: (activities: readonly MarketingActivity[]) => {
      if (apiClient === null) return Promise.reject(new Error("市场活动暂时无法删除。"));
      return apiClient.deleteMarketingActivities({
        activities: activities.map((activity) => ({
          activityId: activity.id,
          version: activity.version,
        })),
      });
    },
    onSuccess: (_result, deletedActivities) => {
      message.success(`已删除 ${deletedActivities.length} 个市场活动`);
      setSelectedActivities([]);
      if (
        selectedActivityId !== null &&
        deletedActivities.some(({ id }) => id === selectedActivityId)
      ) {
        closeDetail();
      }
      void queryClient.invalidateQueries({ queryKey: marketingActivityKeys.all });
    },
  });
  const uploadActivityImageMutation = useMutation({
    mutationFn: ({
      activity,
      files,
      imageType,
    }: {
      activity: MarketingActivity;
      files: readonly File[];
      imageType: MarketingActivityImageType;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("市场活动图片暂时无法上传。"))
        : apiClient.uploadAttachments(
            { targetId: activity.id, targetType: "marketing-activity" },
            files,
            { marketingActivityImageType: imageType },
          ),
    onSuccess: attachmentUploadFeedback,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: marketingActivityKeys.attachments });
    },
  });
  const downloadAttachmentMutation = useMutation({
    mutationFn: ({ activity, fileId }: { activity: MarketingActivity; fileId: number }) =>
      apiClient === null
        ? Promise.reject(new Error("市场活动附件暂时无法下载。"))
        : apiClient.downloadAttachment({
            fileId,
            targetId: activity.id,
            targetType: "marketing-activity",
          }),
    onSuccess: (download) => saveControlledDownload(download),
  });
  const withdrawAttachmentMutation = useMutation({
    mutationFn: ({
      activity,
      fileId,
      version,
    }: {
      activity: MarketingActivity;
      fileId: number;
      version: number;
    }) =>
      apiClient === null
        ? Promise.reject(new Error("市场活动附件暂时无法撤回。"))
        : apiClient.withdrawAttachment(
            { fileId, targetId: activity.id, targetType: "marketing-activity" },
            version,
          ),
    onSuccess: () => {
      message.success("附件已撤回");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: marketingActivityKeys.attachments });
    },
  });
  const activities: PageResult<MarketingActivity> = activitiesQuery.data
    ? toMarketingActivityPage(activitiesQuery.data)
    : { ...marketingActivityDefaultPageRequest, items: [], meta: {}, total: null };
  const departmentNames = useMemo(
    () =>
      new Map((departmentsQuery.data ?? []).map((department) => [department.id, department.name])),
    [departmentsQuery.data],
  );
  const renderActivityImageCard = (
    activity: MarketingActivity,
    imageType: MarketingActivityImageType,
    title: string,
    recommendedSize: string,
    imageQuery: typeof coverImageQuery,
  ) => {
    const images = (imageQuery.data?.objectList ?? []).filter(
      (
        attachment,
      ): attachment is components["schemas"]["AttachmentResponse"] & { fileId: number } =>
        attachment.fileId !== undefined &&
        Number.isSafeInteger(attachment.fileId) &&
        attachment.fileId > 0,
    );
    const limitReached = images.length >= 9;
    const isUploadingThisGroup =
      uploadActivityImageMutation.isPending &&
      uploadActivityImageMutation.variables?.imageType === imageType;

    return (
      <Card
        extra={
          <Space wrap>
            {canReadAttachments ? (
              <Button disabled={imageQuery.isFetching} onClick={() => void imageQuery.refetch()}>
                刷新
              </Button>
            ) : null}
            {canWriteAttachments ? (
              <Upload
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                beforeUpload={(file) => {
                  if (uploadActivityImageMutation.isPending) {
                    message.info("活动图片正在上传，请等待当前文件处理完成。");
                    return Upload.LIST_IGNORE;
                  }
                  if (limitReached) {
                    message.warning(`${title}最多上传 9 张，请撤回已有图片后再试。`);
                    return Upload.LIST_IGNORE;
                  }
                  uploadActivityImageMutation.mutate({ activity, files: [file], imageType });
                  return Upload.LIST_IGNORE;
                }}
                disabled={uploadActivityImageMutation.isPending || limitReached}
                showUploadList={false}
              >
                <Button disabled={limitReached} loading={isUploadingThisGroup} type="primary">
                  上传图片
                </Button>
              </Upload>
            ) : null}
          </Space>
        }
        size="small"
        title={`${title}（${images.length}/9）`}
      >
        <Typography.Paragraph type="secondary">
          推荐尺寸 {recommendedSize}；最多 9 张，仅支持
          PNG、JPG、JPEG。上传后必须通过服务端安全检查，才会显示并可下载。
        </Typography.Paragraph>
        {!canReadAttachments ? (
          <Alert
            title="当前身份没有图片读取权限，无法查看或下载已上传图片。"
            showIcon
            type="info"
          />
        ) : null}
        {imageQuery.isError ? (
          <Alert
            title={errorMessage(imageQuery.error, `${title}暂时无法加载`)}
            showIcon
            type="error"
          />
        ) : null}
        {canReadAttachments ? (
          <List
            dataSource={images}
            loading={imageQuery.isFetching}
            locale={{ emptyText: imageQuery.isLoading ? "" : "暂无可下载图片" }}
            renderItem={(attachment) => {
              const attachmentVersion = attachment.version;
              const canWithdraw =
                canWriteAttachments &&
                typeof attachmentVersion === "number" &&
                Number.isSafeInteger(attachmentVersion) &&
                attachmentVersion >= 0;
              return (
                <List.Item
                  actions={[
                    <Button
                      disabled={downloadAttachmentMutation.isPending}
                      key={`download-${attachment.fileId}`}
                      loading={
                        downloadAttachmentMutation.isPending &&
                        downloadAttachmentMutation.variables?.fileId === attachment.fileId
                      }
                      type="link"
                      onClick={() =>
                        downloadAttachmentMutation.mutate({ activity, fileId: attachment.fileId })
                      }
                    >
                      下载
                    </Button>,
                    ...(canWithdraw
                      ? [
                          <Popconfirm
                            cancelText="取消"
                            key={`withdraw-${attachment.fileId}`}
                            okButtonProps={{ danger: true }}
                            okText="撤回"
                            onConfirm={() =>
                              withdrawAttachmentMutation.mutate({
                                activity,
                                fileId: attachment.fileId,
                                version: attachmentVersion,
                              })
                            }
                            title="确认撤回此图片？"
                          >
                            <Button
                              danger
                              disabled={withdrawAttachmentMutation.isPending}
                              loading={
                                withdrawAttachmentMutation.isPending &&
                                withdrawAttachmentMutation.variables?.fileId === attachment.fileId
                              }
                              type="link"
                            >
                              撤回
                            </Button>
                          </Popconfirm>,
                        ]
                      : []),
                  ]}
                >
                  <List.Item.Meta
                    description={`${attachment.mediaType ?? "媒体类型未提供"} · ${formatFileSize(attachment.actualBytes)}`}
                    title={attachment.displayName?.trim() || `图片 #${attachment.fileId}`}
                  />
                </List.Item>
              );
            }}
            rowKey={(attachment) => attachment.fileId}
          />
        ) : null}
      </Card>
    );
  };

  const effectiveEditorSource =
    editorSource !== undefined ? editorSource : openCreateFromSearch ? null : undefined;
  const activityRowSelection: TableProps<MarketingActivity>["rowSelection"] = canDelete
    ? {
        onChange: (_selectedRowKeys, selectedRows) => setSelectedActivities(selectedRows),
        selectedRowKeys: selectedActivities.map((activity) => activity.id),
      }
    : undefined;
  const columns: ColumnsType<MarketingActivity> = [
    {
      dataIndex: "name",
      key: "name",
      title: "活动名称",
      render: (name: string, activity) => (
        <Button type="link" onClick={() => openDetail(activity.id)}>
          {name}
        </Button>
      ),
    },
    {
      dataIndex: "relatedObjectType",
      key: "relatedObjectType",
      title: "关联对象",
      render: (value: RelatedObjectType) => (
        <Tag>{relatedObjectTypeLabel(value, relatedObjectTypes)}</Tag>
      ),
    },
    {
      dataIndex: "createdByActorId",
      key: "creator",
      title: "创建人",
      render: (value: number) => `成员 ${value}`,
    },
    {
      dataIndex: "activityType",
      key: "activityType",
      title: "活动类型",
      render: (value?: string) =>
        value === undefined || value === "" ? "—" : (activityTypeLabels.get(value) ?? value),
    },
    { dataIndex: "startTime", key: "startTime", title: "开始时间", render: formatDateTime },
    { dataIndex: "endTime", key: "endTime", title: "截止时间", render: formatDateTime },
    { dataIndex: "viewCount", key: "viewCount", title: "浏览数" },
    { dataIndex: "submissionCount", key: "submissionCount", title: "提交数" },
    { dataIndex: "budget", key: "budget", title: "活动预算", render: formatBudget },
    {
      dataIndex: "address",
      key: "address",
      title: "活动地址",
      render: (value?: string) => value || "—",
    },
    { dataIndex: "updatedTime", key: "updatedTime", title: "更新时间", render: formatDateTime },
    { dataIndex: "createdTime", key: "createdTime", title: "创建时间", render: formatDateTime },
    { dataIndex: "status", key: "status", title: "状态", render: (status) => <Tag>{status}</Tag> },
  ];

  function openEditor(source: MarketingActivity | null) {
    setMemberKeyword("");
    form.resetFields();
    form.setFieldsValue(
      toMarketingActivityDraft(source, authorization?.actorId, defaultRelatedObjectType),
    );
    setEditorSource(source);
  }

  function closeEditor() {
    setEditorSource(undefined);
    if (openCreateFromSearch) setSearchParams(searchWith(searchParams, { create: undefined }));
  }

  function setKeyword(keyword: string) {
    setSelectedActivities([]);
    setSearchParams(searchWith(searchParams, { keyword: keyword.trim() || undefined, page: 1 }));
  }

  function setRelatedObjectType(value: RelatedObjectType | undefined) {
    setSelectedActivities([]);
    setSearchParams(searchWith(searchParams, { page: 1, relatedObjectType: value }));
  }

  function openDetail(activityId: number) {
    setSearchParams(searchWith(searchParams, { activityId }));
  }

  function closeDetail() {
    setSearchParams(searchWith(searchParams, { activityId: undefined }));
  }

  return (
    <RouteAuthority authority={authority.marketingActivitiesRead}>
      <main>
        <PageHeader
          description="市场活动的检索和操作均由服务端按当前租户、成员资格和资源权限裁决。"
          title="市场活动管理"
        />
        <ActionAuthority authority={authority.marketingActivitiesWrite}>
          <Button style={{ marginBottom: 16 }} type="primary" onClick={() => openEditor(null)}>
            新建活动
          </Button>
        </ActionAuthority>
        <FilterBar
          activeFilters={[
            ...(request.keyword
              ? [
                  {
                    key: "keyword",
                    label: `活动名称：${request.keyword}`,
                    onClear: () => setKeyword(""),
                  },
                ]
              : []),
            ...(currentRelatedObjectType
              ? [
                  {
                    key: "relatedObjectType",
                    label: `关联对象：${relatedObjectTypeLabel(currentRelatedObjectType, relatedObjectTypes)}`,
                    onClear: () => setRelatedObjectType(undefined),
                  },
                ]
              : []),
          ]}
          onClearAll={() => {
            setSelectedActivities([]);
            setSearchParams(
              searchWith(searchParams, {
                keyword: undefined,
                page: 1,
                relatedObjectType: undefined,
              }),
            );
          }}
          search={{
            label: "搜索活动名称",
            onSearch: setKeyword,
            placeholder: "活动名称",
            value: request.keyword,
          }}
          trailing={
            <Select<RelatedObjectType>
              allowClear
              aria-label="关联对象筛选"
              disabled={activityConfigurationQuery.data === undefined}
              loading={activityConfigurationQuery.isLoading}
              notFoundContent={
                activityConfigurationQuery.data === undefined
                  ? "关联对象目录暂时不可用"
                  : "没有可选关联对象"
              }
              options={relatedObjectTypes.map((option) => ({
                label: option.displayName,
                value: option.code,
              }))}
              placeholder="关联对象：全部"
              style={{ minWidth: 156 }}
              value={currentRelatedObjectType}
              onChange={(value) => setRelatedObjectType(value)}
            />
          }
        />
        {activityConfigurationQuery.isError ? (
          <Alert
            title={errorMessage(activityConfigurationQuery.error, "市场活动配置暂时无法加载")}
            showIcon
            style={{ marginBottom: 16 }}
            type="error"
          />
        ) : null}
        <DataWorkspace
          errorMessage={
            activitiesQuery.isError
              ? errorMessage(activitiesQuery.error, "市场活动暂时无法加载")
              : undefined
          }
          label="市场活动数据工作区"
        >
          <ResponsiveDataList
            bulkActions={
              canDelete ? (
                <Popconfirm
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  okText="删除"
                  onConfirm={() => batchDeleteMutation.mutate(selectedActivities)}
                  title={`确认删除已选择的 ${selectedActivities.length} 个市场活动？`}
                >
                  <Button danger loading={batchDeleteMutation.isPending}>
                    批量删除
                  </Button>
                </Popconfirm>
              ) : undefined
            }
            columns={columns}
            loading={activitiesQuery.isLoading}
            onPageChange={(nextPage, nextSize) => {
              setSelectedActivities([]);
              setSearchParams(searchWith(searchParams, { page: nextPage, size: nextSize }));
            }}
            page={activities}
            renderMobileItem={(activity) => (
              <Card size="small" title={activity.name}>
                <Space orientation="vertical" size="small" style={{ display: "flex" }}>
                  <Typography.Text>
                    {relatedObjectTypeLabel(activity.relatedObjectType, relatedObjectTypes)}
                  </Typography.Text>
                  <Typography.Text>{`${formatDateTime(activity.startTime)} 至 ${formatDateTime(activity.endTime)}`}</Typography.Text>
                  <Typography.Text>{`浏览 ${activity.viewCount} · 提交 ${activity.submissionCount}`}</Typography.Text>
                  <Typography.Text>{formatBudget(activity.budget)}</Typography.Text>
                  <Tag>{activity.status}</Tag>
                  <Button size="small" onClick={() => openDetail(activity.id)}>
                    查看
                  </Button>
                </Space>
              </Card>
            )}
            rowKey={(activity) => activity.id}
            rowSelection={activityRowSelection}
            selectedRowCount={selectedActivities.length}
          />
          {batchDeleteMutation.isError ? (
            <Alert
              title={errorMessage(batchDeleteMutation.error, "批量删除市场活动暂时失败")}
              showIcon
              type="error"
            />
          ) : null}
        </DataWorkspace>
      </main>
      <ActivityEditor
        actorId={authorization?.actorId}
        canCreateMarketingForms={canCreateMarketingForms}
        canReadMarketingForms={canReadMarketingForms}
        canReadOrganization={canReadOrganization}
        departments={departmentsQuery.data ?? []}
        form={form}
        initialValues={toMarketingActivityDraft(
          effectiveEditorSource ?? null,
          authorization?.actorId,
          defaultRelatedObjectType,
        )}
        memberKeyword={memberKeyword}
        members={memberQuery.data ?? []}
        marketingForms={marketingFormsQuery.data?.objectList ?? []}
        marketingFormConfiguration={marketingFormConfigurationQuery.data}
        marketingFormConfigurationLoading={marketingFormConfigurationQuery.isLoading}
        marketingFormsLoading={marketingFormsQuery.isLoading}
        activityConfiguration={activityConfigurationQuery.data}
        activityConfigurationLoading={activityConfigurationQuery.isLoading}
        defaultRelatedObjectType={defaultRelatedObjectType}
        relatedObjectTypes={relatedObjectTypes}
        onCancel={closeEditor}
        onMemberSearch={setMemberKeyword}
        onSubmit={(draft) => saveMutation.mutate({ draft, source: effectiveEditorSource ?? null })}
        open={effectiveEditorSource !== undefined}
        source={effectiveEditorSource ?? null}
        submitting={saveMutation.isPending}
      />
      <Drawer
        destroyOnHidden
        onClose={closeDetail}
        open={selectedActivityId !== null}
        title="市场活动详情"
        width={720}
      >
        {selectedActivityQuery.isLoading ? (
          <div
            aria-label="正在加载市场活动详情"
            style={{ display: "grid", minHeight: 240, placeItems: "center" }}
          >
            <Spin size="large" />
          </div>
        ) : selectedActivityQuery.isError ? (
          <Alert
            action={
              <Button
                size="small"
                type="primary"
                onClick={() => void selectedActivityQuery.refetch()}
              >
                重试
              </Button>
            }
            title={errorMessage(selectedActivityQuery.error, "市场活动详情暂时无法加载")}
            showIcon
            type="error"
          />
        ) : selected === undefined ? null : (
          <Space orientation="vertical" size="middle" style={{ display: "flex" }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="活动名称">{selected.name}</Descriptions.Item>
              <Descriptions.Item label="关联对象">
                {relatedObjectTypeLabel(selected.relatedObjectType, relatedObjectTypes)}
              </Descriptions.Item>
              <Descriptions.Item label="公开表单">
                {selected.marketingFormPublicId ? (
                  <a
                    href={`/public/marketing-forms/${encodeURIComponent(selected.marketingFormPublicId)}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    打开公开表单
                  </a>
                ) : selected.marketingFormId === undefined || selected.marketingFormId === null ? (
                  "—"
                ) : (
                  "已关联表单，尚未启用公开访问"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="参与人员">
                {selected.participantActorIds.map((actorId) => `成员 ${actorId}`).join("、")}
              </Descriptions.Item>
              <Descriptions.Item label="参与部门">
                {selected.participantDepartmentIds.length === 0
                  ? "—"
                  : selected.participantDepartmentIds
                      .map(
                        (departmentId) =>
                          departmentNames.get(departmentId) ?? `部门 ${departmentId}`,
                      )
                      .join("、")}
              </Descriptions.Item>
              <Descriptions.Item label="活动时间">
                {`${formatDateTime(selected.startTime)} 至 ${formatDateTime(selected.endTime)}`}
              </Descriptions.Item>
              <Descriptions.Item label="活动类型">
                {selected.activityType
                  ? (activityTypeLabels.get(selected.activityType) ?? selected.activityType)
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="浏览数">{selected.viewCount}</Descriptions.Item>
              <Descriptions.Item label="提交数">{selected.submissionCount}</Descriptions.Item>
              <Descriptions.Item label="活动预算">
                {formatBudget(selected.budget)}
              </Descriptions.Item>
              <Descriptions.Item label="活动地址">{selected.address || "—"}</Descriptions.Item>
              <Descriptions.Item label="活动简介">{selected.description || "—"}</Descriptions.Item>
              <Descriptions.Item label="每个用户一次">
                {selected.oneSubmissionPerUser ? "是" : "否"}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag>{selected.status}</Tag>
              </Descriptions.Item>
            </Descriptions>
            {renderActivityImageCard(selected, "COVER", "活动图片", "290 × 220", coverImageQuery)}
            {renderActivityImageCard(
              selected,
              "DETAIL",
              "活动详情图片",
              "750 × 600",
              detailImageQuery,
            )}
            <Space wrap>
              <ActionAuthority authority={authority.marketingActivitiesWrite}>
                <Button onClick={() => openEditor(selected)}>编辑</Button>
              </ActionAuthority>
              <ActionAuthority authority={authority.marketingActivitiesDelete}>
                <Popconfirm
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  okText="删除"
                  onConfirm={() => deleteMutation.mutate(selected)}
                  title="确认删除此市场活动？"
                >
                  <Button danger loading={deleteMutation.isPending}>
                    删除
                  </Button>
                </Popconfirm>
              </ActionAuthority>
            </Space>
            {saveMutation.isError ||
            deleteMutation.isError ||
            batchDeleteMutation.isError ||
            uploadActivityImageMutation.isError ||
            downloadAttachmentMutation.isError ||
            withdrawAttachmentMutation.isError ? (
              <Alert
                title={errorMessage(
                  saveMutation.error ??
                    deleteMutation.error ??
                    batchDeleteMutation.error ??
                    uploadActivityImageMutation.error ??
                    downloadAttachmentMutation.error ??
                    withdrawAttachmentMutation.error,
                  "市场活动操作暂时失败",
                )}
                showIcon
                type="error"
              />
            ) : null}
          </Space>
        )}
      </Drawer>
    </RouteAuthority>
  );
}
