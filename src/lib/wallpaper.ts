export const WALLPAPER_STORAGE_KEY = "komari-signal-control-wallpaper-v1";
export const DEFAULT_WALLPAPER_STRENGTH = 20;
export const MAX_WALLPAPER_BYTES = 20 * 1024 * 1024;

export interface PersonalWallpaper {
  image?: string;
  name?: string;
  strength: number;
}

export function wallpaperStrength(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && value !== null && value !== "" && value !== undefined
    ? Math.max(5, Math.min(45, number))
    : DEFAULT_WALLPAPER_STRENGTH;
}

export function parseWallpaper(raw: string | null): PersonalWallpaper | null {
  if (!raw) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return null;
    const record = saved as Record<string, unknown>;
    if (record.image !== undefined && (
      typeof record.image !== "string" || record.image.length > 6_000_000 ||
      !/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(record.image)
    )) return null;
    if (record.image === undefined && typeof record.strength !== "number") return null;
    return {
      ...(typeof record.image === "string" ? { image: record.image } : {}),
      ...(typeof record.name === "string" ? { name: record.name.slice(0, 255) } : {}),
      strength: wallpaperStrength(record.strength),
    };
  } catch {
    return null;
  }
}

export function backgroundUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim(), window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export async function prepareWallpaper(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL("image/webp", 0.86);
    if (encoded.length > 6_000_000) throw new Error("Processed image is too large");
    return encoded;
  } finally {
    URL.revokeObjectURL(url);
  }
}
