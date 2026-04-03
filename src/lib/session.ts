export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("cyberdash-session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("cyberdash-session", id);
  }
  return id;
}
