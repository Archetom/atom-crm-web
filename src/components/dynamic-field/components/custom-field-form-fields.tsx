import { Button, Divider, Form, Input, Radio, Select, Typography } from "antd";
import type { DepartmentOption } from "~/components/entity-selector/department-option";
import type { MemberOption } from "~/components/entity-selector/member-option";
import type { CustomFieldValues } from "../model/custom-field-values";
import { customFieldFormDefinitions, toCustomFieldFormValues } from "../model/custom-field-form";
import type { FieldDefinition } from "../model/field-definition";

function valuesWithUpdate(
  values: CustomFieldValues,
  code: string,
  nextValues: readonly string[],
): CustomFieldValues {
  const next = { ...values } as Record<string, readonly string[]>;
  if (nextValues.length === 0) delete next[code];
  else next[code] = nextValues;
  return next;
}

function scalarValue(values: readonly string[]): string | undefined {
  return values[0];
}

function FieldControl({
  departmentOptions,
  disabled,
  field,
  memberOptions,
  memberOptionsLoading,
  onMemberSearch,
  values,
  onChange,
}: Readonly<{
  departmentOptions: readonly DepartmentOption[];
  disabled: boolean;
  field: FieldDefinition;
  memberOptions: readonly MemberOption[];
  memberOptionsLoading: boolean;
  onMemberSearch?(value: string): void;
  values: readonly string[];
  onChange(values: readonly string[]): void;
}>) {
  switch (field.fieldType) {
    case "SELECT":
      return (
        <Select
          allowClear={!field.required}
          aria-label={field.displayName}
          disabled={disabled}
          options={field.options.map((option) => ({ label: option.label, value: option.value }))}
          placeholder={`请选择${field.displayName}`}
          value={scalarValue(values)}
          onChange={(value: string | undefined) => onChange(value === undefined ? [] : [value])}
        />
      );
    case "MULTI_SELECT":
      return (
        <Select
          allowClear
          aria-label={field.displayName}
          disabled={disabled}
          mode="multiple"
          options={field.options.map((option) => ({ label: option.label, value: option.value }))}
          placeholder={`请选择${field.displayName}`}
          value={[...values]}
          onChange={(value: string[]) => onChange(value)}
        />
      );
    case "BOOLEAN":
      return (
        <Radio.Group
          aria-label={field.displayName}
          disabled={disabled}
          options={[
            { label: "是", value: "true" },
            { label: "否", value: "false" },
          ]}
          value={scalarValue(values)}
          onChange={(event) => onChange([event.target.value as string])}
        />
      );
    case "USER":
      return (
        <Select
          allowClear
          aria-label={field.displayName}
          disabled={disabled}
          filterOption={false}
          loading={memberOptionsLoading}
          mode="multiple"
          notFoundContent={memberOptionsLoading ? "正在加载成员目录" : "未找到可选择成员"}
          options={memberOptions.map((member) => ({
            label: member.displayName,
            value: String(member.actorId),
          }))}
          placeholder={`从服务端成员目录选择${field.displayName}`}
          showSearch
          value={[...values]}
          onChange={(value: string[]) => onChange(value)}
          onSearch={onMemberSearch}
        />
      );
    case "DEPARTMENT":
      return (
        <Select
          allowClear
          aria-label={field.displayName}
          disabled={disabled}
          mode="multiple"
          notFoundContent="未找到可选择部门"
          options={departmentOptions.map((department) => ({
            label: department.name,
            value: String(department.departmentId),
          }))}
          placeholder={`从服务端部门目录选择${field.displayName}`}
          value={[...values]}
          onChange={(value: string[]) => onChange(value)}
        />
      );
    case "TEXTAREA":
    case "ADDRESS":
      return (
        <Input.TextArea
          aria-label={field.displayName}
          disabled={disabled}
          maxLength={500}
          placeholder={`请输入${field.displayName}`}
          rows={4}
          value={scalarValue(values) ?? ""}
          onChange={(event) => onChange([event.currentTarget.value])}
        />
      );
    case "DATE":
      return (
        <Input
          aria-label={field.displayName}
          disabled={disabled}
          type="date"
          value={scalarValue(values) ?? ""}
          onChange={(event) => onChange([event.currentTarget.value])}
        />
      );
    case "DATETIME":
      return (
        <Input
          aria-label={field.displayName}
          disabled={disabled}
          type="datetime-local"
          value={scalarValue(values) ?? ""}
          onChange={(event) => onChange([event.currentTarget.value])}
        />
      );
    case "INTEGER":
    case "DECIMAL":
      return (
        <Input
          aria-label={field.displayName}
          disabled={disabled}
          inputMode="decimal"
          placeholder={`请输入${field.displayName}`}
          value={scalarValue(values) ?? ""}
          onChange={(event) => onChange([event.currentTarget.value])}
        />
      );
    case "EMAIL":
      return (
        <Input
          aria-label={field.displayName}
          disabled={disabled}
          inputMode="email"
          maxLength={500}
          placeholder={`请输入${field.displayName}`}
          value={scalarValue(values) ?? ""}
          onChange={(event) => onChange([event.currentTarget.value])}
        />
      );
    case "PHONE":
      return (
        <Input
          aria-label={field.displayName}
          disabled={disabled}
          inputMode="tel"
          maxLength={16}
          placeholder="例如 +8613812345678"
          value={scalarValue(values) ?? ""}
          onChange={(event) => onChange([event.currentTarget.value])}
        />
      );
    case "URL":
      return (
        <Input
          aria-label={field.displayName}
          disabled={disabled}
          inputMode="url"
          maxLength={500}
          placeholder={`请输入${field.displayName}`}
          value={scalarValue(values) ?? ""}
          onChange={(event) => onChange([event.currentTarget.value])}
        />
      );
    case "TEXT":
      return (
        <Input
          aria-label={field.displayName}
          disabled={disabled}
          maxLength={500}
          placeholder={`请输入${field.displayName}`}
          value={scalarValue(values) ?? ""}
          onChange={(event) => onChange([event.currentTarget.value])}
        />
      );
    default:
      return null;
  }
}

/** Renders only catalog-backed scalar custom fields. */
export function CustomFieldFormFields({
  departmentOptions = [],
  definitions,
  disabled,
  errors = {},
  memberOptions = [],
  memberOptionsLoading = false,
  onMemberSearch,
  onFieldChange,
  showExplicitClear = false,
  values,
  onChange,
}: Readonly<{
  departmentOptions?: readonly DepartmentOption[];
  definitions: readonly FieldDefinition[];
  disabled: boolean;
  errors?: Readonly<Record<string, string>>;
  memberOptions?: readonly MemberOption[];
  memberOptionsLoading?: boolean;
  onMemberSearch?(value: string): void;
  onFieldChange?(code: string): void;
  /** Lets blank-starting edit forms record an intentional server-value clear. */
  showExplicitClear?: boolean;
  values: CustomFieldValues;
  onChange(values: CustomFieldValues): void;
}>) {
  const fields = customFieldFormDefinitions(definitions);
  if (fields.length === 0) return null;

  return (
    <>
      <Divider orientation="horizontal" titlePlacement="start">
        自定义字段
      </Divider>
      {fields.map((definition, index) => {
        const section = definition.sectionName ?? "未分组";
        const previousSection = fields[index - 1]?.sectionName ?? "未分组";
        const showSection = index === 0 || section !== previousSection;
        return (
          <div key={definition.code}>
            {showSection ? (
              <Divider orientation="horizontal" plain titlePlacement="start">
                {section}
              </Divider>
            ) : null}
            <Form.Item
              label={definition.displayName}
              required={definition.required}
              validateStatus={errors[definition.code] === undefined ? undefined : "error"}
            >
              <div>
                <FieldControl
                  departmentOptions={departmentOptions}
                  disabled={disabled}
                  field={definition}
                  memberOptions={memberOptions}
                  memberOptionsLoading={memberOptionsLoading}
                  onMemberSearch={onMemberSearch}
                  values={values[definition.code] ?? []}
                  onChange={(nextValues) => {
                    onChange(
                      valuesWithUpdate(
                        values,
                        definition.code,
                        toCustomFieldFormValues([definition], {
                          [definition.code]: nextValues,
                        })[definition.code] ?? [],
                      ),
                    );
                    onFieldChange?.(definition.code);
                  }}
                />
                {showExplicitClear ? (
                  <Button
                    aria-label={`清空${definition.displayName}`}
                    disabled={disabled}
                    htmlType="button"
                    size="small"
                    style={{ marginTop: 8 }}
                    type="link"
                    onClick={() => {
                      onChange(valuesWithUpdate(values, definition.code, []));
                      onFieldChange?.(definition.code);
                    }}
                  >
                    清空此字段
                  </Button>
                ) : null}
              </div>
            </Form.Item>
            {errors[definition.code] === undefined ? null : (
              <Typography.Text role="alert" type="danger">
                {errors[definition.code]}
              </Typography.Text>
            )}
          </div>
        );
      })}
    </>
  );
}
