import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, value, ...props }, ref) => {
    // Un champ number contrôlé à 0 affiche "0" en permanence et gêne la
    // saisie manuelle (on doit d'abord l'effacer) : on l'affiche vide tant
    // que la valeur réelle est 0, Number("") valant 0 au onChange suivant.
    const displayValue = type === "number" && (value === 0 || value === "0") ? "" : value;
    return (
      <input ref={ref} type={type} value={displayValue} className={cn("input-base", className)} {...props} />
    );
  }
);

Input.displayName = "Input";
