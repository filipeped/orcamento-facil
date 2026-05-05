// Tags de clientes — armazenadas em localStorage por enquanto.
// Quando a migration `clients.tags TEXT[]` for aplicada, migrar pra Supabase.

const STORAGE_KEY = "fechaaqui_client_tags";

export const TAG_COLORS = [
  { id: "blue", label: "Azul", bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  { id: "green", label: "Verde", bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  { id: "amber", label: "Âmbar", bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  { id: "purple", label: "Roxo", bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  { id: "pink", label: "Rosa", bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" },
  { id: "neutral", label: "Cinza", bg: "bg-neutral-100", text: "text-neutral-700", border: "border-neutral-200" },
] as const;

export type TagColor = typeof TAG_COLORS[number]["id"];

export interface ClientTag {
  label: string;
  color: TagColor;
}

type AllTags = Record<string, ClientTag[]>; // clientKey → tags[]

function readAll(): AllTags {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data: AllTags) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore quota */ }
}

export function getClientTags(clientKey: string): ClientTag[] {
  const all = readAll();
  return all[clientKey] || [];
}

export function setClientTags(clientKey: string, tags: ClientTag[]) {
  const all = readAll();
  if (tags.length === 0) {
    delete all[clientKey];
  } else {
    all[clientKey] = tags;
  }
  writeAll(all);
}

export function addClientTag(clientKey: string, tag: ClientTag) {
  const current = getClientTags(clientKey);
  if (current.find((t) => t.label.toLowerCase() === tag.label.toLowerCase())) return;
  setClientTags(clientKey, [...current, tag]);
}

export function removeClientTag(clientKey: string, label: string) {
  const current = getClientTags(clientKey);
  setClientTags(clientKey, current.filter((t) => t.label !== label));
}

export function getTagColorClasses(color: TagColor) {
  return TAG_COLORS.find((c) => c.id === color) || TAG_COLORS[5];
}
