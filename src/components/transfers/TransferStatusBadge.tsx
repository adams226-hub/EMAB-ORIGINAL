import { Badge } from "@/components/ui/Badge";
import type { TransferStatus } from "@/types/database.types";

const LABELS: Record<TransferStatus, string> = {
  pending: "En attente",
  in_transit: "En transit",
  received: "Réceptionné",
  cancelled: "Annulé",
};

const TONES: Record<TransferStatus, "warning" | "brand" | "success" | "default"> = {
  pending: "default",
  in_transit: "warning",
  received: "success",
  cancelled: "default",
};

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}
