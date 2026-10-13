type NavigableItem = { href: string };

export function getActiveHref(pathname: string, items: NavigableItem[]) {
  return items
    .filter(({ href }) => href === "/dashboard"
      ? pathname === href || pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`))
    .sort((first, second) => second.href.length - first.href.length)[0]?.href ?? null;
}
