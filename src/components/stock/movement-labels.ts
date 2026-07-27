import type { MovementType } from "@/types/database.types";

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  in: "Entrée",
  out: "Sortie",
  transfer_out: "Transfert sortant",
  transfer_in: "Transfert entrant",
  adjustment_in: "Ajustement (+)",
  adjustment_out: "Ajustement (-)",
  inventory_correction_in: "Inventaire (+)",
  inventory_correction_out: "Inventaire (-)",
};

export const MOVEMENT_TYPE_TONE: Record<MovementType, "success" | "danger" | "brand" | "warning"> = {
  in: "success",
  out: "danger",
  transfer_out: "warning",
  transfer_in: "brand",
  adjustment_in: "success",
  adjustment_out: "danger",
  inventory_correction_in: "success",
  inventory_correction_out: "danger",
};

export function isCreditMovement(type: MovementType) {
  return type === "in" || type === "transfer_in" || type === "adjustment_in" || type === "inventory_correction_in";
}
