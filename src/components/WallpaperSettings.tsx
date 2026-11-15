import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, RotateCcw, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { MAX_WALLPAPER_BYTES, prepareWallpaper } from "@/lib/wallpaper";

export default function WallpaperSettings() {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const label = (cn: string, en: string) => zh ? cn : en;
  const { personal, image, strength, setPersonal } = useWallpaper();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const task = useRef(0);
  const titleId = useId();
  const strengthId = useId();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => () => { task.current++; }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const saveStatus = (saved: boolean) => setStatus(saved
    ? label("已自动保存到此浏览器。", "Saved in this browser.")
    : label("已应用，但浏览器无法保存设置，刷新后可能需要重新选择。", "Applied for this session. Browser storage is unavailable."));

  const choose = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setStatus(label("请选择 JPG、PNG 或 WebP 图片。", "Choose a JPG, PNG or WebP image."));
      return;
    }
    if (file.size > MAX_WALLPAPER_BYTES) {
      setStatus(label("图片超过 20 MB，请选择较小的图片。", "Choose an image smaller than 20 MB."));
      return;
    }
    const currentTask = ++task.current;
    setBusy(true);
    setStatus(label("正在准备背景图片…", "Preparing your wallpaper…"));
    try {
      const prepared = await prepareWallpaper(file);
      if (task.current !== currentTask) return;
      saveStatus(setPersonal({ image: prepared, name: file.name, strength }));
    } catch {
      if (task.current === currentTask) setStatus(label("无法处理图片，请尝试一张较小的 JPG、PNG 或 WebP 图片。", "Unable to process this image. Try a smaller JPG, PNG or WebP."));
    } finally {
      if (task.current === currentTask) setBusy(false);
    }
  };

  return <>
    <button className="zzz-wallpaper-trigger" type="button" title={label("自定义背景", "Customize background")}
      aria-label={label("自定义背景", "Customize background")} aria-haspopup="dialog"
      onClick={() => { dialog.current?.showModal(); setOpen(true); }}>
      <ImagePlus size={17} aria-hidden="true" />
    </button>
    <dialog ref={dialog} className="zzz-wallpaper-dialog" aria-labelledby={titleId}
      onClose={() => setOpen(false)} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close();
      }}>
      <div className="zzz-wallpaper-heading"><span>PERSONALIZE / 01</span><button type="button" className="zzz-wallpaper-close" aria-label={label("关闭", "Close")} onClick={() => dialog.current?.close()}><X size={19} /></button></div>
      <h2 id={titleId}>{label("让信号，有你的底色。", "Your signal. Your backdrop.")}</h2>
      <p className="zzz-wallpaper-description">{label("选择喜欢的图片作为个人背景，仅保存在此浏览器。恢复默认后使用站点背景。", "Choose a personal image, saved only in this browser. Reset to use the site background.")}</p>
      <div className="zzz-wallpaper-preview">
        {image ? <img src={image} alt="" style={{ opacity: strength / 100 }} /> : <span>NO WALLPAPER / DEFAULT CANVAS</span>}
        <span className="zzz-wallpaper-preview-mark" aria-hidden="true">SIGNAL<br />CONTROL.</span>
      </div>
      <p className="zzz-wallpaper-filename">{personal?.name || (image ? label("站点默认背景", "Site wallpaper") : "JPG / PNG / WEBP · MAX 20 MB")}</p>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
      <div className="zzz-wallpaper-actions">
        <button type="button" className="zzz-button zzz-button-primary" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} />{label("选择本地图片", "Choose image")}</button>
        <button type="button" className="zzz-button" disabled={!personal && !busy} onClick={() => { task.current++; setBusy(false); saveStatus(setPersonal(null)); }}><RotateCcw size={15} />{label("恢复默认", "Reset")}</button>
      </div>
      <label className="zzz-wallpaper-strength" htmlFor={strengthId}>{label("背景强度", "Image intensity")}<output>{strength}%</output></label>
      <input id={strengthId} type="range" min="5" max="45" step="1" value={strength} disabled={!image || busy} onChange={event => saveStatus(setPersonal({ ...personal, strength: Number(event.target.value) }))} />
      <p className="zzz-wallpaper-status" role="status" aria-live="polite">{status || label("降低强度可让监控数据更清晰。", "Lower the intensity to keep your metrics easy to read.")}</p>
      <div className="zzz-wallpaper-done"><button className="zzz-button zzz-button-primary" type="button" onClick={() => dialog.current?.close()}>{label("完成", "Done")}</button></div>
    </dialog>
  </>;
}
