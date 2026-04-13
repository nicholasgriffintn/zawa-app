export function normaliseAppPathname(pathname: string): string {
  const normalised = pathname.replace(/\/+$/, "");
  return normalised || "/";
}
