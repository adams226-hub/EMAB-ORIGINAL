import { Badge } from "@/components/ui/Badge";
import type { PaymentStatus } from "@/types/database.types";

const LABELS: Record<PaymentStatus, string> = {
  paid: "Payé",
  partial: "Partiel",
  unpaid: "Impayé",
  cancelled: "Annulée",
};

const TONES: Record<PaymentStatus, "success" | "warning" | "danger" | "default"> = {
  paid: "success",
  partial: "warning",
  unpaid: "danger",
  cancelled: "default",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}
