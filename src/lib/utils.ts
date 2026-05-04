import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Corrige caracteres com encoding quebrado (UTF-8 interpretado como Latin-1)
 * Ex: "IrrigaÃ§Ãµes" -> "Irrigações"
 */
export function fixEncoding(text: string | null | undefined): string {
  if (!text) return "";

  // Tenta decodificar UTF-8 mal interpretado como Latin-1
  try {
    // Se contém sequências típicas de UTF-8 quebrado (Ã seguido de outro char)
    if (text.includes("\u00C3")) {
      // Converte de volta: Latin-1 -> bytes -> UTF-8
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i);
      }
      const decoded = new TextDecoder("utf-8").decode(bytes);
      // Só retorna se a decodificação fez sentido (não tem caracteres de substituição)
      if (!decoded.includes("\uFFFD")) {
        return decoded;
      }
    }
  } catch {
    // Se falhar, retorna o original
  }

  return text;
}
