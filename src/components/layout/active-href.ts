/**
 * Renvoie, parmi une liste de hrefs de navigation, celui qui correspond
 * le mieux au chemin courant (correspondance exacte ou préfixe le plus
 * long) — évite que deux entrées de nav imbriquées (ex. /stock et
 * /stock/movements) s'affichent actives simultanément.
 */
export function findActiveHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];
}
