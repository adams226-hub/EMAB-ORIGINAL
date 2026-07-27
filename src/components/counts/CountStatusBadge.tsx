import { Badge } from "@/components/ui/Badge";
import type { CountStatus } from "@/types/database.types";

const LABELS: Record<CountStatus, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  validated: "Validé",
  cancelled: "Annulé",
};

const TONES: Record<CountStatus, "warning" | "brand" | "success" | "default"> = {
  draft: "default",
  submitted: "warning",
  validated: "success",
  cancelled: "default",
};

export function CountStatusBadge({ status }: { status: CountStatus }) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}
