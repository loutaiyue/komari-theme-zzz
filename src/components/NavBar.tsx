import ThemeSwitch from "./ThemeSwitch";
import LanguageSwitch from "./Language";
import WallpaperSettings from "./WallpaperSettings";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LogIn, Settings2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useTranslation } from "react-i18next";
import { loginPath } from "@/utils/loginRedirect";
import { motion } from "motion/react";
import { CONTROL_MOTION, SURFACE_MOTION } from "@/lib/motion";
import { useViewTransitionNavigate } from "@/hooks/useViewTransitionNavigate";
import { MotionButton, MotionIconButton } from "./ui/motion-radix";
import { Skeletonize, skeletonText } from "./ui/skeleton";
import "@/styles/signal-home.css";

/** 首页相关 chunk 预取：悬停品牌名时先下载，点下去时新页面能在共享元素过渡的窗口内挂好 */
const preloadIndex = () => {
  void import("../pages/Index");
  void import("./NodeDisplay");
};

const INSTANCE_PATH = /^\/instance\/([^/]+)/;

/**
 * 导航栏控件：按下时轻微回弹（control 层），整体在页面加载时从上方落入（surface 层）。
 * 注意导航栏本身不参与 layout 动画，避免滚动时抖动。
 */
const NavBar = () => {
  const { publicInfo, isLoading: publicInfoLoading } = usePublicInfo();
  const { t, i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  // 站点信息还没到（且没失败）：站名位置先放一条与常见站名等宽的骨架
  const siteNameLoading = !publicInfo && publicInfoLoading;
  const location = useLocation();
  const { account } = useAccount();
  const { navigate: navigateWithTransition } = useViewTransitionNavigate();
  const loginRedirect = loginPath(location.pathname, location.search);
  // 在详情页时，品牌链接回首页走共享元素回程：标题「飞回」它在列表里的那张卡片
  const currentInstance = INSTANCE_PATH.exec(location.pathname)?.[1];
  return (
    <motion.nav
      // 左右边距由 _layout 的 main 统一提供，导航栏只留上下 group；品牌区与控件组之间 group
      className="km-navbar nav-bar zzz-navbar"
      aria-label={zh ? "主导航" : "Main navigation"}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        y: SURFACE_MOTION.slide,
        opacity: SURFACE_MOTION.fade,
      }}
    >
      <div className="km-navbar-brand">
        <Link
          to="/"
          className="zzz-brand-link"
          onPointerEnter={currentInstance ? preloadIndex : undefined}
          onFocus={currentInstance ? preloadIndex : undefined}
          onClick={(event) => {
            if (
              !currentInstance ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey ||
              event.button !== 0
            ) {
              return;
            }
            event.preventDefault();
            navigateWithTransition("/", { sharedHero: currentInstance });
          }}
        >
          <span className="zzz-brand-mark" aria-hidden="true">K</span>
          <span className="zzz-brand-copy">
          <Skeletonize
            as="span"
            loading={siteNameLoading}
            className="zzz-brand-name"
          >
            {publicInfo?.sitename ?? (siteNameLoading ? skeletonText(8) : "Komari")}
          </Skeletonize>
          <span className="zzz-brand-caption">SIGNAL CONTROL</span>
          </span>
        </Link>
      </div>

      <div className="zzz-nav-links">
        <Link to="/" className={!currentInstance ? "is-active" : undefined} aria-current={!currentInstance ? "page" : undefined}>
          <span>{zh ? "总览" : "Overview"}</span>
        </Link>
        <a href={currentInstance ? "/#nodes" : "#nodes"}><span>{zh ? "节点网络" : "Node network"}</span></a>
      </div>

      {/*
        控件组本身不做按压缩放：按下单个按钮时整组一起缩会显得「整条栏在晃」。
        每个按钮自己就是 motion 元素（不额外包 div），保持原有 DOM 层级与选择器。
      */}
      <div className="km-navbar-controls">
        <MotionIconButton
          variant="soft"
          className="zzz-github-link"
          title="Komari · GitHub"
          aria-label="Komari · GitHub"
          onClick={() => {
            window.open("https://github.com/komari-monitor", "_blank", "noopener,noreferrer");
          }}
          whileHover={CONTROL_MOTION.hover}
          whileTap={CONTROL_MOTION.tap}
          transition={CONTROL_MOTION.transition}
        >
          <GitHubLogoIcon />
        </MotionIconButton>
        <WallpaperSettings />
        <ThemeSwitch />
        <LanguageSwitch />
        <MotionButton
          className="zzz-login-button"
          title={account?.logged_in ? t("settings.title", "Settings") : t("login.title")}
          aria-label={account?.logged_in ? t("settings.title", "Settings") : t("login.title")}
          onClick={() => {
            window.location.href =
              account?.logged_in ? "/admin/dashboard" : loginRedirect;
          }}
          whileHover={CONTROL_MOTION.hover}
          whileTap={CONTROL_MOTION.tap}
          transition={CONTROL_MOTION.transition}
        >
          {account?.logged_in ? <Settings2 size={16} /> : <LogIn size={16} />}
          <span>{account?.logged_in ? t("settings.title", "Settings") : t("login.title")}</span>
        </MotionButton>
      </div>
    </motion.nav>
  );
};

const NavBarWithAccount = () => (
  <AccountProvider>
    <NavBar />
  </AccountProvider>
);

export default NavBarWithAccount;
