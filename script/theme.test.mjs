import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Transpile only this browser-independent module so the checks also run on Node 22.
const source = await readFile(new URL("../src/lib/wallpaper.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { parseWallpaper, wallpaperStrength } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("existing HTML-preview wallpaper survives migration", () => {
  const wallpaper = { image: "data:image/webp;base64,UklGRg==", name: "my wallpaper.webp", strength: 32 };
  assert.deepEqual(parseWallpaper(JSON.stringify(wallpaper)), wallpaper);
});

test("damaged or unexpected browser storage falls back safely", () => {
  for (const value of [null, "{broken", "null", "[]", "1", '"text"', '{}', '{"image":"https://example.com/image.jpg"}', '{"image":"data:image/svg+xml;base64,PHN2Zz4="}', '{"image":42}']) {
    assert.equal(parseWallpaper(value), null, String(value));
  }
  assert.equal(parseWallpaper(JSON.stringify({ image: "data:image/png;base64," + "A".repeat(6_000_001) })), null);
});

test("intensity is bounded and site-default intensity is predictable", () => {
  assert.equal(wallpaperStrength(undefined), 20);
  assert.equal(wallpaperStrength(null), 20);
  assert.equal(wallpaperStrength(""), 20);
  assert.equal(wallpaperStrength("invalid"), 20);
  assert.equal(wallpaperStrength(-10), 5);
  assert.equal(wallpaperStrength(99), 45);
  assert.equal(wallpaperStrength("28"), 28);
  assert.deepEqual(parseWallpaper('{"strength":35}'), { strength: 35 });
});

test("theme manifest has a separate install identity and a packaged preview", async () => {
  const manifest = JSON.parse(await readFile(new URL("../komari-theme.json", import.meta.url), "utf8"));
  assert.equal(manifest.short, "signal-control");
  assert.equal(manifest.configuration.type, "managed");
  assert.match(await readFile(new URL(`../${manifest.preview}`, import.meta.url), "utf8"), /<svg/);
  const fields = manifest.configuration.data.filter(field => field.key);
  assert.equal(new Set(fields.map(field => field.key)).size, fields.length);
  for (const key of ["backgroundImageUrlDesktop", "backgroundImageUrlMobile", "backgroundImageOpacity", "chartDashboardTemplate"]) {
    assert.ok(fields.some(field => field.key === key), key);
  }
});
