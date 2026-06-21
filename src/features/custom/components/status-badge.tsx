import { Badge } from "@/components/ui/badge";
import { CUSTOM_STATUS_LABEL } from "../transitions";
import type { CustomRequestStatus } from "../types";

const VARIANT: Record<
  CustomRequestStatus,
  "warning" | "info" | "success" | "neutral" | "danger"
> = {
  pending: "warning",
  quoted: "info",
  approved: "info",
  in_production: "info",
  done: "success",
  rejected: "danger",
};

export function CustomStatusBadge({ status }: { status: CustomRequestStatus }) {
  return <Badge variant={VARIANT[status]}>{CUSTOM_STATUS_LABEL[status]}</Badge>;
}
