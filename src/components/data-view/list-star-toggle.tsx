import { StarFilled, StarOutlined } from "@ant-design/icons";
import { Button } from "antd";

interface ListStarToggleProps {
  readonly starred: boolean;
  readonly loading: boolean;
  readonly onToggle: (starred: boolean) => void;
}

/** An accessible, immediate personal follow control for CRM list rows. */
export function ListStarToggle({ starred, loading, onToggle }: ListStarToggleProps) {
  const label = starred ? "取消关注" : "关注";

  return (
    <Button
      aria-label={label}
      icon={starred ? <StarFilled /> : <StarOutlined />}
      loading={loading}
      size="small"
      title={label}
      type="text"
      onClick={() => onToggle(!starred)}
    />
  );
}
