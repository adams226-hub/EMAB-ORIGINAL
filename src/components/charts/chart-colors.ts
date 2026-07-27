/**
 * Palette validée (skill dataviz) — huit teintes catégorielles dans un
 * ordre fixe (jamais cyclées au-delà de 8, jamais réassignées par rang).
 * L'app ne propose pas de thème sombre pour l'instant : seules les valeurs
 * "light" sont utilisées.
 */
export const CHART_CATEGORICAL = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

export const CHART_SEQUENTIAL_BLUE = [
  "#cde2fb",
  "#9ec5f4",
  "#6da7ec",
  "#3987e5",
  "#256abf",
  "#184f95",
] as const;

export const CHART_STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export const CHART_CHROME = {
  gridline: "#e1e0d9",
  axis: "#c3c2b7",
  mutedText: "#898781",
  secondaryText: "#52514e",
  primaryText: "#0b0b0b",
} as const;
