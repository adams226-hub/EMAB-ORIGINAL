/**
 * Ordre d'affichage des catégories quand les produits sont regroupés par
 * section (POS, Catalogue) : les catégories métier du cœur de l'activité
 * d'abord, dans un ordre fixe, puis les autres par ordre alphabétique,
 * puis les produits sans catégorie en dernier.
 */
export const CATEGORY_ORDER = ["Aliments volaille", "Produits vétérinaires", "Équipements d'élevage"];
export const NO_CATEGORY_LABEL = "Sans catégorie";

export function groupByCategory<T extends { category_name: string | null }>(
  items: T[]
): { category: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.category_name ?? NO_CATEGORY_LABEL;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const otherKeys = Array.from(groups.keys())
    .filter((key) => !CATEGORY_ORDER.includes(key) && key !== NO_CATEGORY_LABEL)
    .sort((a, b) => a.localeCompare(b));

  const orderedKeys = [
    ...CATEGORY_ORDER.filter((key) => groups.has(key)),
    ...otherKeys,
    ...(groups.has(NO_CATEGORY_LABEL) ? [NO_CATEGORY_LABEL] : []),
  ];

  return orderedKeys.map((category) => ({ category, items: groups.get(category)! }));
}
