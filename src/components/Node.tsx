import React from "react";
import "@/styles/signal-nodes.css";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { Card, Text, Badge, IconButton } from "@radix-ui/themes";
import type { LiveData, Record } from "../types/LiveData";
import UsageBar from "./UsageBar";
import Flag from "./Flag";
import { useTranslation } from "react-i18next";
import Tips from "./ui/tips";

import { formatBytes, formatUptime } from "@/utils/unitHelper";
import { compareNodesByStatus, EMPTY_LIVE_RECORD } from "@/utils/nodeOrder";
import { settledLayoutTransition, useOrderSettled } from "@/hooks/useOrderSettled";
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SPRING,
  MOTION_TRANSITION,
} from "@/lib/motion";
import { useViewTransitionNavigate } from "@/hooks/useViewTransitionNavigate";
import { sharedHeroStyle, useSharedHero } from "@/lib/sharedElement";
import { StatusFeedback } from "@/components/motion";
import { useKmReducedMotion } from "@/components/motion/MotionProvider";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import { useViewTransitionActive } from "@/lib/viewTransitionState";
import { preloadInstancePage } from "./preloadInstancePage";

interface NodeProps {
  basic: NodeBasicInfo;
  live: Record | undefined;
  online: boolean;
  showIpTagsInCard: boolean;
  /** live 数据的第一次请求还没回来：数值、状态画成与文字等宽的骨架条（不是 0 或「离线」） */
  liveLoading?: boolean;
  /** 列表首次定序已完成：之前的重排瞬时完成（见 useOrderSettled） */
  orderSettled?: boolean;
  /** 列表中的序号：用于错峰进场（上限 140ms，避免长列表末尾等太久） */
  index?: number;
  /** React 19：memo 组件以 prop 形式接收 ref。AnimatePresence popLayout 需要它来测量退场卡片 */
  ref?: React.Ref<HTMLDivElement>;
}

const Node = React.memo(
  ({ basic, live, online, showIpTagsInCard, liveLoading = false, orderSettled = true, index = 0, ref }: NodeProps) => {
  const [t] = useTranslation();
  /*
    进场参数只在挂载时取一次（Staging）：
    - 错峰延迟用挂载时的序号；之后排序变化不会让 animate 的 delay 跟着变。
    - 若挂载发生在共享元素过渡里（详情页 -> 首页回程），卡片直接就位，
      让浏览器把标题补间回来，而不是卡片自己再淡入上浮一次。
  */
  const viewTransitionActive = useViewTransitionActive();
  const [enter] = React.useState(() => ({
    delay: Math.min(index * 0.02, 0.14),
    skip: viewTransitionActive,
  }));
  /*
    进场用 motion value 手动驱动（放在内层）：重排时 React 用 insertBefore 移动卡片节点，
    子树的 ref 会重新挂一遍，motion 把这当作再次挂载、退回 initial 重播进场（卡片下沉 12px 又浮上来）。
    没有 initial 就不会重播。视觉参数与原来一致：错峰延迟、y 12 -> 0、scale 0.98 -> 1、淡入。
  */
  const reduced = useKmReducedMotion();
  const enterOpacity = useMotionValue(enter.skip ? 1 : 0);
  const enterY = useMotionValue(enter.skip || reduced ? 0 : 12);
  const enterScale = useMotionValue(enter.skip || reduced ? 1 : 0.98);
  React.useEffect(() => {
    if (enter.skip) return;
    const controls = [
      animate(enterOpacity, 1, { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard, delay: enter.delay }),
      animate(enterY, 0, { ...MOTION_SPRING.layout, delay: enter.delay }),
      animate(enterScale, 1, { ...MOTION_SPRING.layout, delay: enter.delay }),
    ];
    return () => controls.forEach((control) => control.stop());
  }, [enter, enterOpacity, enterY, enterScale]);
  const { navigate: navigateWithTransition } = useViewTransitionNavigate();
  // 只有被点击的那张卡片会获得共享元素名（浏览器要求名字在文档内唯一）
  const isSharedHero = useSharedHero(basic.uuid);
  const liveData = live || EMPTY_LIVE_RECORD;
  const osName = React.useMemo(() => getOSName(basic.os), [basic.os]);

  const memoryUsagePercent = basic.mem_total
    ? (liveData.ram.used / basic.mem_total) * 100
    : 0;
  const diskUsagePercent = basic.disk_total
    ? (liveData.disk.used / basic.disk_total) * 100
    : 0;

  const uploadSpeed = formatBytes(liveData.network.up);
  const downloadSpeed = formatBytes(liveData.network.down);
  const totalUpload = formatBytes(liveData.network.totalUp);
  const totalDownload = formatBytes(liveData.network.totalDown);
  // 小骨架：只包住数值本身，标签和布局照常渲染；live 到达时同一批 DOM 上条淡出、数字淡入。
  // 加载中渲染等宽空白（skeletonText），骨架浮现前的 150ms 里也不会露出「0 B」之类的假数值
  const sk = (node: React.ReactNode, chars = 8) => (
    <Skeletonize as="span" loading={liveLoading}>
      {liveLoading ? skeletonText(chars) : node}
    </Skeletonize>
  );
  //const totalTraffic = formatBytes(liveData.network.totalUp + liveData.network.totalDown);
  return (
    <motion.div
      ref={ref}
      /*
        content 层：layout="position" 只补间位置（重排/筛选时邻居顺势补位），
        不补间尺寸——卡片高度随数据变化时不会把文字拉伸。
      */
      layout="position"
      exit={{
        opacity: 0,
        scale: 0.97,
        transition: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.in },
      }}
      transition={{
        // 首次定序（实时状态到达后离线节点移到末尾）瞬时完成，不让卡片横穿网格
        layout: settledLayoutTransition(orderSettled),
        y: MOTION_SPRING.layout,
        scale: MOTION_SPRING.layout,
        opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
      }}
      // Anticipation：悬停先抬起一点（只在真正的鼠标悬停时，触屏点一下不会卡在抬起状态）
      whileHover={{ y: -2, transition: MOTION_SPRING.snappy }}
      onPointerEnter={preloadInstancePage}
      onFocusCapture={preloadInstancePage}
      style={{ width: "100%", margin: "0 auto" }}
      className="km-node-card-motion"
    >
      <motion.div style={{ width: "100%", height: "100%", opacity: enterOpacity, y: enterY, scale: enterScale }}>
      <Card
        style={{ width: "100%", height: "100%", margin: "0 auto" }}
        id={basic.uuid}
        data-status={liveLoading ? "loading" : online ? "online" : "offline"}
        className="km-node-card node-card zzz-node-card"
      >
        <div className="zzz-node-top">
          <span className="zzz-node-region"><Flag flag={basic.region} /></span>
          <span className="zzz-node-index" title={basic.uuid}>
            NODE / {String(index + 1).padStart(2, "0")}
          </span>
          <div className="zzz-node-controls">
            <AnimatePresence initial={false}>
              {live?.message && (
                <motion.span
                  key="message"
                  className="inline-flex"
                  initial={{ opacity: 0, scale: 0.86 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.86, transition: MOTION_TRANSITION.fadeOut }}
                  transition={MOTION_SPRING.pop}
                >
                  <Tips color="#CE282E">{live.message}</Tips>
                </motion.span>
              )}
            </AnimatePresence>
            <MiniPingChartFloat
              uuid={basic.uuid}
              hours={24}
              trigger={
                <IconButton
                  variant="ghost"
                  size="1"
                  title={t("nodeCard.chart", "Chart")}
                  aria-label={t("nodeCard.chart", "Chart")}
                >
                  <TrendingUp size="14" />
                </IconButton>
              }
            />
          </div>
          <StatusFeedback state={liveLoading ? "loading" : online}>
            <Badge
              color={liveLoading ? "gray" : online ? "green" : "red"}
              variant="soft"
              className="km-node-status zzz-node-status"
              title={liveLoading ? undefined : t(online ? "nodeCard.online" : "nodeCard.offline")}
              aria-label={liveLoading ? undefined : t(online ? "nodeCard.online" : "nodeCard.offline")}
            >
              {liveLoading ? (
                <Skeletonize as="span" loading>{skeletonText(6)}</Skeletonize>
              ) : online ? "ONLINE" : "OFFLINE"}
            </Badge>
          </StatusFeedback>
        </div>

        <Link
          to={`/instance/${basic.uuid}`}
          className="zzz-node-link"
          title={basic.name}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            navigateWithTransition(`/instance/${basic.uuid}`, { sharedHero: basic.uuid });
          }}
        >
          <Text
            className="km-node-name"
            weight="bold"
            size="4"
            truncate
            as="span"
            style={{
              maxWidth: "100%",
              ...(isSharedHero ? { width: "fit-content", alignSelf: "flex-start" } : null),
              ...sharedHeroStyle(isSharedHero),
            }}
          >
            {basic.name}
          </Text>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <div className="zzz-node-spec" title={`${basic.os} / ${basic.arch} / ${basic.cpu_name}`}>
          <span>{osName}</span><span>/</span><span>{basic.cpu_cores} vCPU</span><span>/</span>
          <span>{formatBytes(basic.mem_total)}</span><span>/</span><span>{formatBytes(basic.disk_total)}</span>
        </div>

        <div className="zzz-node-metrics">
          <UsageBar label="CPU" value={liveData.cpu.usage} loading={liveLoading} unavailable={!online && !liveLoading} />
          <div title={`${t("nodeCard.ram")}: ${formatBytes(liveData.ram.used)} / ${formatBytes(basic.mem_total)}`}>
            <UsageBar label="RAM" value={memoryUsagePercent} loading={liveLoading} unavailable={!online && !liveLoading} />
          </div>
          <div title={`${t("nodeCard.disk")}: ${formatBytes(liveData.disk.used)} / ${formatBytes(basic.disk_total)}`}>
            <UsageBar label="DISK" value={diskUsagePercent} loading={liveLoading} unavailable={!online && !liveLoading} />
          </div>
        </div>
        <div className="zzz-node-capacities">
          <span>RAM {sk(online ? formatBytes(liveData.ram.used) : "—", 4)} / {formatBytes(basic.mem_total)}</span>
          <span>DISK {sk(online ? formatBytes(liveData.disk.used) : "—", 4)} / {formatBytes(basic.disk_total)}</span>
        </div>

        <div className="zzz-node-traffic">
          <span title={t("nodeCard.networkDownloadSpeed")}><b>↓</b>{sk(online ? `${downloadSpeed}/s` : "—", 9)}</span>
          <span title={t("nodeCard.networkUploadSpeed")}><b>↑</b>{sk(online ? `${uploadSpeed}/s` : "—", 9)}</span>
        </div>
        <div className="zzz-node-transfer">
          <span>{t("nodeCard.totalTraffic")}</span>
          <span>{sk(<>↓ {totalDownload} <span className="zzz-node-transfer-divider">/</span> ↑ {totalUpload}</>, 14)}</span>
        </div>
        {basic.traffic_limit > 0 && (
          <div className="zzz-node-quota">
            <UsageBar
              label={`${(basic.traffic_limit_type ?? "sum").toUpperCase()} / ${formatBytes(basic.traffic_limit)}`}
              value={getTrafficPercentage(liveData.network.totalUp, liveData.network.totalDown, basic.traffic_limit, basic.traffic_limit_type ?? "sum")}
              max={Infinity}
              loading={liveLoading}
            />
          </div>
        )}
        <div className="zzz-node-bottom">
          <span className="zzz-node-tag" title={basic.group || basic.arch}>{basic.group || basic.arch || "INSTANCE"}</span>
          <span className="zzz-node-uptime" title={t("nodeCard.uptime")}>
            {sk(online ? <>UP / {formatUptime(liveData.uptime, t)}</> : "NO SIGNAL", 9)}
          </span>
        </div>
        <PriceTags
          price={basic.price}
          billing_cycle={basic.billing_cycle}
          expired_at={basic.expired_at}
          currency={basic.currency}
          tags={basic.tags}
          ip4={showIpTagsInCard ? basic.ipv4 : undefined}
          ip6={showIpTagsInCard ? basic.ipv6 : undefined}
        />
      </Card>
      </motion.div>
    </motion.div>
  );
});

export default Node;

type NodeGridProps = {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  onlineSet: ReadonlySet<string>;
  /** live 数据第一次请求还没回来 */
  liveLoading?: boolean;
};

/**
 * 节点列表还没到时的占位节点：用真实的卡片/表格行组件渲染，外面包 Skeletonize，
 * 骨架的形状就是卡片本身。名字等可变文本用 skeletonText 控制条的长度。
 */
export const createPlaceholderNodes = (count: number): NodeBasicInfo[] =>
  Array.from({ length: count }, (_, index) => ({
    uuid: `km-placeholder-${index}`,
    name: skeletonText(9 + ((index * 5) % 7)),
    cpu_name: "",
    virtualization: "",
    arch: "amd64",
    cpu_cores: 0,
    os: "Linux",
    kernel_version: "",
    gpu_name: "",
    region: "",
    mem_total: 8 * 1024 ** 3,
    swap_total: 0,
    disk_total: 64 * 1024 ** 3,
    version: "",
    weight: index,
    price: 0,
    tags: "",
    billing_cycle: 30,
    currency: "",
    group: "",
    traffic_limit: 0,
    traffic_limit_type: undefined,
    expired_at: "",
    created_at: "",
    updated_at: "",
  }));

import { Link } from "react-router-dom";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import PriceTags from "./PriceTags";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import MiniPingChartFloat from "./MiniPingChartFloat";
import { getOSName } from "@/utils";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
export const NodeGrid = ({ nodes, liveData, onlineSet, liveLoading = false }: NodeGridProps) => {
  const { publicInfo, isLoading: publicInfoLoading } = usePublicInfo();
  // 顺序依赖实时状态和「离线节点位置」设置：两者都到了才算定序完成
  const orderSettled = useOrderSettled(!liveLoading && !publicInfoLoading);
  const showIpTagsInCard = Boolean(
    publicInfo?.theme_settings?.showIpTagsInCard,
  );
  const offlineServerPosition =
    publicInfo?.theme_settings?.offlineServerPosition; // "First/Keep/Last"

  // 排序节点：先按权重排序，权重大的靠前，再根据用户设置排序
  const sortedNodes = React.useMemo(
    () => [...nodes].sort((a, b) => compareNodesByStatus(a, b, onlineSet, offlineServerPosition)),
    [nodes, offlineServerPosition, onlineSet],
  );

  return (
    /*
      网格容器本身不开 layout：它没有可见背景，尺寸补间只会给子卡片带来缩放矫正。
      position: relative 让 popLayout 退场的卡片以网格为定位参照，原地淡出。
    */
    <div
      // 同类卡片之间 block；左右边距由 _layout 的 main 提供，网格自身不加 padding
      className="km-node-list zzz-node-grid gap-km-block"
      style={{
        position: "relative",
        display: "grid",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/*
        卡片进场用「错峰」：第 1 张先落位，后面的依次跟上（Follow-through）。
        错峰上限 140ms，卡片再多也不会让最后一张等太久（Timing）。
        分组/搜索筛选时：离开的卡片 popLayout 原地淡出，剩下的卡片 layout 补位。
        用 initial 而非 initial={false}：首次渲染与网格/表格切换都要有落位感。
      */}
      <AnimatePresence initial mode="popLayout">
        {sortedNodes.map((node, index) => {
          const isOnline = onlineSet.has(node.uuid);
          const nodeData = liveData.data[node.uuid];

          return (
            <Node
              key={node.uuid}
              basic={node}
              live={nodeData}
              online={isOnline}
              showIpTagsInCard={showIpTagsInCard}
              liveLoading={liveLoading}
              orderSettled={orderSettled}
              index={index}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
};

function getTrafficPercentage(
  totalUp: number,
  totalDown: number,
  limit: number,
  type: "max" | "min" | "sum" | "up" | "down",
) {
  if (limit === 0) return 0;
  switch (type) {
    case "max":
      return (Math.max(totalUp, totalDown) / limit) * 100;
    case "min":
      return (Math.min(totalUp, totalDown) / limit) * 100;
    case "sum":
      return ((totalUp + totalDown) / limit) * 100;
    case "up":
      return (totalUp / limit) * 100;
    case "down":
      return (totalDown / limit) * 100;
    default:
      return 0;
  }
}
