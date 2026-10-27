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
import { useNavigate, useSearchParams } from "react-router";

import { ApiError } from "~/api/errors/api-error";
import { useAuth } from "~/app/auth/auth-context";
import { useBootstrap } from "~/app/bootstrap/bootstrap-context";
import { authority, hasAuthority } from "~/app/permissions/authority";
import { RouteAuthority } from "~/app/permissions/route-authority";
import type { CustomerOption } from "~/components/entity-selector/customer-option";

import { ReturnVisitOwnerSelect } from "../components/return-visit-owner-select";
import { toReturnVisitCreateRequest } from "../model/return-visit-form";
import {
  returnVisitFormOptions,
  returnVisitSatisfactionOptions,
  type ReturnVisitForm,
  type ReturnVisitSatisfaction,
} from "../model/return-visit-fields";
import { returnVisitListPathFromCreateSearch } from "../model/return-visit-list-route";
import { returnVisitKeys } from "../model/query-keys";

import styles from "./customer-return-visit-create-page.module.css";

interface ReturnVisitCreateFormValues {
  customerId?: number;
  ownerActorId?: number;
  visitForm?: ReturnVisitForm;
  satisfaction?: ReturnVisitSatisfaction;
  remark?: string;
  visitTime?: Dayjs | null;
}

/**
 * The global entry mirrors the reference list's creation affordance while
 * selecting a customer exclusively from the current caller's server-visible
 * directory. The customer-context route remains the narrow fast path.
 */
export function ReturnVisitCreatePage() {
  const { apiClient, authorization } = useBootstrap();
  const { state: authState } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<ReturnVisitCreateFormValues>();
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [createdReturnVisitId, setCreatedReturnVisitId] = useState<number | null>(null);
  const identityKey = authState?.identityKey ?? "pending";
  const returnPath = returnVisitListPathFromCreateSearch(searchParams.toString());
  const canReadCustomers = hasAuthority(authorization, authority.customersRead);
  const canReadReturnVisits = hasAuthority(authorization, authority.returnVisitsRead);
  const customerCandidateQuery = useQuery({
    queryKey: ["return-visit-customer-selector", identityKey, customerKeyword] as const,
    queryFn: () =>
      apiClient === null
        ? Promise.reject(new Error("Customer selection is unavailable."))
        : apiClient.getVisibleCustomers({
            keyword: customerKeyword.trim() || undefined,
            page: 1,
            size: 50,
          }),
    enabled: apiClient !== null && customerPickerOpen && canReadCustomers,
  });
  const createMutation = useMutation({
    mutationFn: (values: ReturnVisitCreateFormValues) => {
      if (
        apiClient === null ||
        values.customerId === undefined ||
        values.visitTime === null ||
        values.visitTime === undefined
      ) {
        return Promise.reject(new Error("Return visit creation is unavailable."));
      }
      return apiClient.createReturnVisit(
        toReturnVisitCreateRequest({
          customerId: values.customerId,
          ownerActorId: values.ownerActorId,
          visitForm: values.visitForm,
          satisfaction: values.satisfaction,
          remark: values.remark,
          visitTime: values.visitTime.format("YYYY-MM-DDTHH:mm:ss"),
        }),
      );
    },
    onSuccess: (returnVisit) => {
      void queryClient.invalidateQueries({ queryKey: returnVisitKeys.lists(identityKey) });
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

  function closeCustomerPicker() {
    setCustomerPickerOpen(false);
    setCustomerKeyword("");
  }

  function chooseCustomer(customer: CustomerOption) {
    setSelectedCustomer(customer);
    form.setFieldValue("customerId", customer.id);
    closeCustomerPicker();
  }

  function submit(values: ReturnVisitCreateFormValues) {
    if (
      values.customerId === undefined ||
      values.visitTime === undefined ||
      values.visitTime === null
    ) {
      return;
    }
    createMutation.mutate(values);
  }

  return (
    <RouteAuthority authority={authority.returnVisitsWrite}>
      <main className={styles.page}>
        <section>
          <Typography.Title level={2}>新建回访</Typography.Title>
          <Typography.Text type="secondary">
            先从当前可见客户中选择关联对象，再填写回访时间、回访形式、客户满意度和客户反馈。有分配权限时可选择回访人，留空则由服务端默认当前成员；服务端会在创建时重新校验客户范围和字段权限。
          </Typography.Text>
        </section>
        {!canReadCustomers ? (
          <Alert
            description="回访创建需要从服务端客户目录选择关联客户。请联系管理员补充客户读取权限。"
            title="缺少关联客户目录权限"
            showIcon
            type="warning"
          />
        ) : null}
        {createMutation.isError ? (
          <Alert
            title={
              createMutation.error instanceof ApiError
                ? createMutation.error.message
                : "回访暂时无法创建，请稍后重试"
            }
            showIcon
            type="error"
          />
        ) : null}
        {createdReturnVisitId !== null ? (
          <Alert
            description="当前成员没有回访读取权限，创建结果是否可见仍由服务端数据范围决定。"
            title={`回访已创建，编号 ${createdReturnVisitId}`}
            showIcon
            type="success"
          />
        ) : null}
        <Card title="基本信息">
          <Form
            form={form}
            initialValues={{ visitTime: dayjs() }}
            layout="vertical"
            onFinish={submit}
          >
            <Form.Item name="customerId" rules={[{ required: true, message: "请选择关联客户" }]}>
              <Input type="hidden" />
            </Form.Item>
            <Form.Item label="关联客户" required>
              <Space wrap>
                <Typography.Text>
                  {selectedCustomer === null
                    ? "尚未选择客户"
                    : `${selectedCustomer.name}（客户 ${selectedCustomer.id}）`}
                </Typography.Text>
                <Button
                  disabled={!canReadCustomers || createMutation.isPending}
                  onClick={() => setCustomerPickerOpen(true)}
                >
                  选择客户
                </Button>
              </Space>
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
            <Space>
              <Button disabled={createMutation.isPending} onClick={() => navigate(returnPath)}>
                取消
              </Button>
              <Button
                disabled={!canReadCustomers}
                htmlType="submit"
                loading={createMutation.isPending}
                type="primary"
              >
                创建回访
              </Button>
            </Space>
          </Form>
        </Card>
      </main>
      <Modal
        destroyOnHidden
        footer={null}
        open={customerPickerOpen}
        title="选择关联客户"
        onCancel={closeCustomerPicker}
      >
        <Typography.Paragraph type="secondary">
          候选仅来自服务端返回的当前可见客户；选择后仍会在提交时由服务端核验。
        </Typography.Paragraph>
        <Input.Search
          allowClear
          aria-label="搜索可见客户"
          placeholder="搜索可见客户"
          value={customerKeyword}
          onChange={(event) => setCustomerKeyword(event.currentTarget.value)}
        />
        {customerCandidateQuery.isError ? (
          <Alert
            title={
              customerCandidateQuery.error instanceof ApiError
                ? customerCandidateQuery.error.message
                : "客户候选列表暂时无法加载，请稍后重试"
            }
            showIcon
            style={{ marginTop: 12 }}
            type="error"
          />
        ) : (
          <List
            dataSource={[...(customerCandidateQuery.data ?? [])]}
            loading={customerCandidateQuery.isLoading}
            locale={{ emptyText: "未找到可选择客户" }}
            renderItem={(customer) => (
              <List.Item
                actions={[
                  <Button key={customer.id} type="link" onClick={() => chooseCustomer(customer)}>
                    选择客户
                  </Button>,
                ]}
              >
                <List.Item.Meta description={`客户 ${customer.id}`} title={customer.name} />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </RouteAuthority>
  );
}
