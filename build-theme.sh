#!/usr/bin/env bash
# Build an installable Komari theme archive on Linux or macOS.
set -euo pipefail

for dependency in node npm zip; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        printf 'Missing dependency: %s\n' "$dependency" >&2
        exit 1
    fi
done

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

# Validate before using manifest fields in archive paths. Read separate lines to
# preserve spaces in a relative preview path without evaluating it as shell code.
theme_metadata="$(node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const theme = JSON.parse(fs.readFileSync('komari-theme.json', 'utf8'));
if (typeof theme.short !== 'string' || !/^[a-z0-9-]+$/.test(theme.short) ||
    typeof theme.version !== 'string' || !/^[a-zA-Z0-9.-]+$/.test(theme.version)) {
    throw new Error('Invalid package name or version.');
}
if (typeof theme.preview !== 'string' || !theme.preview ||
    /[\r\n\\]/.test(theme.preview) || path.posix.isAbsolute(theme.preview) ||
    theme.preview.split('/').some(part => part === '..' || part === '' || part === '.')) {
    throw new Error('Preview must be a relative file path inside the theme directory.');
}
console.log([theme.short, theme.version, theme.preview].join('\n'));
NODE
)"
{
    IFS= read -r theme_short
    IFS= read -r theme_version
    IFS= read -r theme_preview
} <<< "$theme_metadata"

printf 'Building %s v%s...\n' "$theme_short" "$theme_version"
npm run build

for required in dist/index.html komari-theme.json "$theme_preview"; do
    if [[ ! -f "$required" ]]; then
        printf 'Missing required theme file: %s\n' "$required" >&2
        exit 1
    fi
done

mkdir -p release
theme_archive="$(pwd)/release/${theme_short}-v${theme_version}.zip"
theme_temp_dir="$(mktemp -d "$(pwd)/release/.package.XXXXXX")"
theme_temp_archive="$theme_temp_dir/theme.zip"
trap 'rm -f "$theme_temp_archive"; rmdir "$theme_temp_dir"' EXIT

# Start a fresh archive so removed build assets cannot linger after a rebuild.
# Only the three theme entries belong at the ZIP root; exclude old ZIP packages.
zip -q -r "$theme_temp_archive" dist komari-theme.json "$theme_preview" -x '*.zip'
mv -f "$theme_temp_archive" "$theme_archive"
printf 'Created theme package: %s\n' "$theme_archive"
