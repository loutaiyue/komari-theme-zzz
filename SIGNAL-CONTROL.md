# SIGNAL CONTROL

采用黑白灰、荧光黄绿和切角面板的 Komari 前端主题。使用原有 API、实时连接、分组和节点详情功能，本地预览中的示例数据不会进入正式构建。

## 本地开发

使用 Node.js 22 或更新版本，运行 `npm install`。复制 `.env.example` 为 `.env.development`，将 `VITE_API_TARGET` 设置为你的 Komari 后端地址，运行 `npm run dev`。

首页、节点卡片/表格和详情页的主题样式位于 `src/styles/signal-*.css`，限定在公开页面的 `.zzz-theme` 内。后台管理页面沿用原有样式。

## 背景设置

- 管理员：主题设置中填写桌面端/移动端背景 URL，设置背景强度（5–45%，默认20%）。移动端留空时使用桌面端图片。
- 访客：导航栏图片按钮支持本地 JPG、PNG、WebP（最大20MB），调整强度、恢复默认。
- 优先级：当前浏览器个人图片 → 对应设备的站点图片 → 主题底色。个人强度覆盖站点强度。
- 本地图片只在浏览器处理与保存，不上传到服务器。最大边缩放到2560px。保存空间不足时仍可在当前页面使用；换浏览器/站点需要重新选择。

## 验证和构建

```sh
npm run test:theme
npm run build
```

Windows PowerShell 打包：

```powershell
.\build-theme.ps1
# 已完成构建时：
.\build-theme.ps1 -SkipBuild
```

Linux/macOS（需 zip）：

```sh
bash build-theme.sh
```

主题包输出为 `release/signal-control-v1.0.0.zip`。ZIP 根目录包含 `komari-theme.json`、`preview.svg` 和 `dist/`。在 Komari 后台「主题管理」上传并应用 SIGNAL CONTROL。主题独立标识为 `signal-control`，可切回原主题。

## 设计与维护

配色、字体、通用控件和背景在 `signal-theme.css`；首页、节点、详情页各有独立样式文件。依赖原有 Radix、Recharts 和 motion，保留原有交互和减少动效偏好。新增主题文案支持中文和英文，其他语言使用英文回退。

升级基础前端时需要合并上游功能变更并重新构建主题。此主题是受绝区零视觉语言启发的独立设计，不包含游戏官网角色、美术或品牌素材。
