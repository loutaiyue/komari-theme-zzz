import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePublicInfo } from "./PublicInfoContext";
import { backgroundUrl, parseWallpaper, wallpaperStrength, WALLPAPER_STORAGE_KEY, type PersonalWallpaper } from "@/lib/wallpaper";

interface WallpaperContextValue {
  personal: PersonalWallpaper | null;
  image: string | undefined;
  strength: number;
  setPersonal: (wallpaper: PersonalWallpaper | null) => boolean;
}

const WallpaperContext = createContext<WallpaperContextValue | null>(null);

function readPersonalWallpaper() {
  try { return parseWallpaper(localStorage.getItem(WALLPAPER_STORAGE_KEY)); }
  catch { return null; }
}

export function WallpaperProvider({ children }: { children: ReactNode }) {
  const { publicInfo } = usePublicInfo();
  const isMobile = useIsMobile();
  const [personal, setPersonalState] = useState(readPersonalWallpaper);
  const settings = publicInfo?.theme_settings;
  const desktop = backgroundUrl(settings?.backgroundImageUrlDesktop);
  const mobile = backgroundUrl(settings?.backgroundImageUrlMobile);
  const siteImage = isMobile ? mobile || desktop : desktop;
  const image = personal?.image || siteImage;
  const strength = personal?.strength ?? wallpaperStrength(settings?.backgroundImageOpacity);

  const setPersonal = useCallback((value: PersonalWallpaper | null) => {
    setPersonalState(value);
    try {
      if (value) localStorage.setItem(WALLPAPER_STORAGE_KEY, JSON.stringify(value));
      else localStorage.removeItem(WALLPAPER_STORAGE_KEY);
      return true;
    } catch { return false; }
  }, []);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === WALLPAPER_STORAGE_KEY || event.key === null) setPersonalState(readPersonalWallpaper());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const value = useMemo(() => ({ personal, image, strength, setPersonal }), [personal, image, strength, setPersonal]);
  return <WallpaperContext.Provider value={value}>{children}</WallpaperContext.Provider>;
}

export function useWallpaper() {
  const context = useContext(WallpaperContext);
  if (!context) throw new Error("useWallpaper requires WallpaperProvider");
  return context;
}
