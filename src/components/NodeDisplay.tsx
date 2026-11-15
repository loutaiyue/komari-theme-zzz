import React, { useState, useMemo, useRef, useEffect, Suspense } from "react";
import {
  Flex,
  Text,
} from "@radix-ui/themes";
import { Search, Grid3X3, Table2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData } from "../types/LiveData";
import { NodeGrid, createPlaceholderNodes } from "./Node";
const loadNodeTable = () => import("./NodeTable");
const NodeTable = React.lazy(loadNodeTable);
import { isRegionMatch } from "@/utils/regionHelper";
import { AnimatePresence, motion } from "motion/react";
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_SPRING,
  MOTION_TRANSITION,
} from "@/lib/motion";
import { AutoHeight } from "@/components/motion";
import Loading from "@/components/loading";
import { Skeletonize, skeletonText } from "@/components/ui/skeleton";
import "./NodeDisplay.css";

/** 节点列表还没到时渲染的占位卡片/行数（真实组件 + Skeletonize） */
const PLACEHOLDER_COUNT = 6;
const PLACEHOLDER_NODES = createPlaceholderNodes(PLACEHOLDER_COUNT);
const PLACEHOLDER_ONLINE: ReadonlySet<string> = new Set();
const EMPTY_LIVE: LiveData = { online: [], data: {} };
/** 筛选/视图/加载状态切换后，外层高度跟随弹簧的时间窗（覆盖卡片退场 + 弹簧落定） */
const HEIGHT_FOLLOW_MS = 900;

export type ViewMode = "grid" | "table";

/** 视图模式定义：icon + 值 + 无障碍标签 */
const VIEW_MODES = [
  { value: "grid" as const, icon: Grid3X3, label: "Grid view" },
  { value: "table" as const, icon: Table2, label: "Table view" },
];

interface NodeDisplayProps {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  /** 节点列表还没到：用占位卡片/行渲染真实组件的骨架 */
  loading?: boolean;
  /** live 数据第一次请求还没回来：卡片里的数值用小骨架 */
  liveLoading?: boolean;
  /** A failed request can produce an empty list without deleting its groups. */
  listError?: string | null;
}

const NodeDisplay: React.FC<NodeDisplayProps> = ({
  nodes,
  liveData,
  loading = false,
  liveLoading = false,
  listError = null,
}) => {
  const [t, i18n] = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    "nodeViewMode",
    "grid",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useLocalStorage<string>(
    "nodeSelectedGroup",
    "all",
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const onlineSet = useMemo(() => new Set(liveData?.online ?? []), [liveData]);

  // 获取所有的分组
  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    nodes.forEach((node) => {
      if (node.group && node.group.trim()) {
        groupSet.add(node.group);
      }
    });
    return Array.from(groupSet).sort();
  }, [nodes]);

  // Only reconcile against a populated successful response. The provider clears
  // its error before retrying while its failed empty list is still present.
  useEffect(() => {
    if (!loading && !listError && nodes.length > 0 && selectedGroup !== "all" && !groups.includes(selectedGroup)) {
      setSelectedGroup("all");
    }
  }, [groups, loading, listError, nodes.length, selectedGroup, setSelectedGroup]);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing = target?.closest("input, textarea, select, [contenteditable='true']");
      const dialogOpen = document.querySelector("[role='dialog'][data-state='open'], dialog[open]");
      // Keep typing and shortcuts inside dialogs independent of node search.
      if (dialogOpen || (editing && target !== searchRef.current)) return;
      if (e.key === "/" && !editing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // 按 Escape 键清空搜索
      if (e.key === "Escape" && target === searchRef.current && searchTerm) {
        setSearchTerm("");
        searchRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchTerm]);

  // 过滤节点
  const filteredNodes = useMemo(() => {
    let result = nodes;

    // 先按分组过滤
    if (selectedGroup !== "all") {
      result = result.filter((node) => node.group === selectedGroup);
    }

    // 再按搜索条件过滤
    if (!searchTerm.trim()) return result;

    const term = searchTerm.toLowerCase().trim();
    return result.filter((node) => {
      // 基本信息搜索
      const basicMatch =
        node.name.toLowerCase().includes(term) ||
        node.os.toLowerCase().includes(term) ||
        node.arch.toLowerCase().includes(term);

      // 地区搜索（支持emoji和地区名称）
      const regionMatch = isRegionMatch(node.region, term);

      // 价格搜索（如果输入数字）
      const priceMatch =
        !isNaN(Number(term)) && node.price.toString().includes(term);

      // 状态搜索
      const isOnline = onlineSet.has(node.uuid);
      const statusMatch =
        ((term === "online" || term === "在线") && isOnline) ||
        ((term === "offline" || term === "离线") && !isOnline);

      return basicMatch || regionMatch || priceMatch || statusMatch;
    });
  }, [nodes, searchTerm, onlineSet, selectedGroup]);

  /*
    舞台高度：只在「换了显示内容」（加载完成、视图切换、筛选、空态）之后的一小段时间里
    让 AutoHeight 跟随，其余时间（表格行展开自带高度弹簧、live 刷新）不干预，
    避免两条高度弹簧互相追赶。在渲染期派生，保证 ResizeObserver 回调时开关已经打开。
  */
  const heightKey = `${loading}|${viewMode}|${selectedGroup}|${searchTerm.trim()}|${filteredNodes.length === 0}`;
  const [heightFollow, setHeightFollow] = useState({ key: heightKey, on: false });
  if (heightFollow.key !== heightKey) {
    setHeightFollow({ key: heightKey, on: true });
  }
  useEffect(() => {
    if (!heightFollow.on) return;
    const id = window.setTimeout(
      () => setHeightFollow((current) => ({ ...current, on: false })),
      HEIGHT_FOLLOW_MS,
    );
    return () => window.clearTimeout(id);
  }, [heightFollow]);

  const stageKey = loading
    ? `skeleton-${viewMode}`
    : filteredNodes.length === 0
      ? searchTerm.trim()
        ? "empty-search"
        : "empty"
      : viewMode;
  const tableFallback = (
    <div>
      <Loading reveal={false} />
    </div>
  );

  return (
    /*
      与上方概览卡之间 section；工具栏（搜索/视图/分组）内部 group；
      工具栏 → 统计行 block；统计行是网格的说明，贴近网格（group）。左右边距由 main 提供。
    */
    <section id="nodes" className="km-node-display zzz-node-section" aria-labelledby="zzz-nodes-heading">
      <div className="zzz-section-heading">
        <span className="zzz-chapter" aria-hidden="true">01</span>
        <h2 id="zzz-nodes-heading">{zh ? "节点网络" : "Node network"}<small>YOUR CONNECTED WORLD</small></h2>
        <span className="zzz-section-rule" aria-hidden="true" />
        <span className="zzz-section-meta"><strong>{loading ? "—" : String(filteredNodes.length).padStart(2, "0")}</strong> NODES</span>
      </div>
      <div className="zzz-node-toolbar">
        <div className="zzz-node-filters" role="group" aria-label={t("common.group")}>
          <button type="button" aria-pressed={selectedGroup === "all"} onClick={() => setSelectedGroup("all")}>
            {t("common.all")} <span>{nodes.length}</span>
          </button>
          {groups.map((group) => (
            <button type="button" key={group} aria-pressed={selectedGroup === group} onClick={() => setSelectedGroup(group)}>
              {group} <span>{nodes.filter((node) => node.group === group).length}</span>
            </button>
          ))}
        </div>
        <div className="zzz-node-actions">
          <div className="zzz-node-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              aria-label={t("search.placeholder")}
              placeholder={t("search.placeholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm ? (
              <button type="button" onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }} aria-label={t("common.clear_search", "Clear search")}>
                <X size={13} />
              </button>
            ) : <kbd aria-hidden="true">/</kbd>}
          </div>
          <div className="zzz-view-switch" role="group" aria-label={t("view.mode")}>
            {VIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              const label = mode.value === "grid" ? (zh ? "卡片视图" : "Grid view") : (zh ? "表格视图" : "Table view");
              return (
                <button
                  type="button"
                  key={mode.value}
                  aria-label={label}
                  title={label}
                  aria-pressed={viewMode === mode.value}
                  onPointerEnter={mode.value === "table" ? () => void loadNodeTable() : undefined}
                  onFocus={mode.value === "table" ? () => void loadNodeTable() : undefined}
                  onClick={() => setViewMode(mode.value)}
                ><Icon size={16} /></button>
              );
            })}
          </div>
        </div>
      </div>
      {/* 搜索结果统计：数字变化时用等宽过渡，避免文字长度跳动 */}
      <Flex justify="between" align="center" className="km-node-summary zzz-node-caption">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={searchTerm.trim() ? "search" : selectedGroup}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{
              opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
              y: MOTION_SPRING.snappy,
            }}
            className="min-w-0"
          >
            {/* 节点列表 / live 数据未到：统计文字画成等宽的条，不先显示「共 0 台」 */}
            <Skeletonize as="span" loading={loading || liveLoading}>
            {loading || liveLoading ? (
              <Text size="2" color="gray">{skeletonText(18)}</Text>
            ) : searchTerm.trim() ? (
              <Text size="2" color="gray">
                {t("search.results", {
                  count: filteredNodes.length,
                  total:
                    selectedGroup === "all"
                      ? nodes.length
                      : nodes.filter((n) => n.group === selectedGroup).length,
                })}
              </Text>
            ) : (
              <Text size="2" color="gray">
                {selectedGroup === "all"
                  ? t("nodeCard.totalNodes", {
                      total: nodes.length,
                      online: liveData?.online?.length || 0,
                    })
                  : t("nodeCard.groupNodes", {
                      group: selectedGroup,
                      total: filteredNodes.length,
                      online: filteredNodes.filter((n) =>
                        onlineSet.has(n.uuid),
                      ).length,
                    })}
              </Text>
            )}
            </Skeletonize>
          </motion.div>
        </AnimatePresence>
      </Flex>

      {/* 节点显示区域：网格/表格和筛选结果切换都用同一套过渡 */}
      <AutoHeight disabled={!heightFollow.on} threshold={4}>
      <div className="km-node-display-stage relative">
        {/*
          网格/表格切换用同步替换 + 快速淡入，不用 mode="wait"：
          wait 会先播完旧视图的退出再挂新视图，中间有一段空档；
          这里的两个视图高度差别很大，空档期页面会明显塌一下。
        */}
        <AnimatePresence mode="popLayout" initial={false}>
          {loading ? (
            /*
              节点列表未到：用真实的卡片/表格行渲染占位节点，外面 Skeletonize——骨架就是卡片本身的形状。
              占位与真实节点不是同一批数据，所以整块交叉淡化：骨架块（保持骨架态）淡出，真实卡片错峰入场。
            */
            <motion.div
              key={stageKey}
              className="w-full"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: MOTION_TRANSITION.fadeOut }}
            >
              {/* 网格不再自带内边距，色卡与卡片本身对齐，不需要 --km-sk-inset */}
              <Skeletonize loading label>
                {viewMode === "grid" ? (
                  <NodeGrid
                    nodes={PLACEHOLDER_NODES}
                    liveData={EMPTY_LIVE}
                    onlineSet={PLACEHOLDER_ONLINE}
                    liveLoading
                  />
                ) : (
                  <Suspense fallback={tableFallback}>
                    <NodeTable
                      nodes={PLACEHOLDER_NODES}
                      liveData={EMPTY_LIVE}
                      onlineSet={PLACEHOLDER_ONLINE}
                      liveLoading
                    />
                  </Suspense>
                )}
              </Skeletonize>
            </motion.div>
          ) : filteredNodes.length === 0 ? (
            <motion.div
              key={stageKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{
                duration: MOTION_DURATION.base,
                ease: MOTION_EASE.standard,
              }}
            >
              <Flex
                direction="column"
                align="center"
                justify="center"
                gap="2"
                className="zzz-node-empty"
              >
                <Text size="4" color="gray">
                  {searchTerm.trim()
                    ? t("search.no_results")
                    : t("nodes.empty")}
                </Text>
                {searchTerm.trim() && (
                  <Text size="2" color="gray">
                    {t("search.try_different")}
                  </Text>
                )}
              </Flex>
            </motion.div>
          ) : (
            /*
              surface 层：两个视图是不同的东西（不是同一块的两种状态），所以用 key 交替。
              只做淡入 + 小位移，不做 scale——整块文字缩放 0.99 会发虚。
              表格/网格内部有各自的入场与补位（卡片错峰、行位置补间）。
            */
            <motion.div
              key={stageKey}
              className="w-full"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{
                opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.standard },
                y: MOTION_SPRING.soft,
              }}
            >
              {viewMode === "grid" ? (
                <NodeGrid
                  nodes={filteredNodes}
                  liveData={liveData}
                  onlineSet={onlineSet}
                  liveLoading={liveLoading}
                />
              ) : (
                <Suspense fallback={tableFallback}>
                  <NodeTable
                    nodes={filteredNodes}
                    liveData={liveData}
                    onlineSet={onlineSet}
                    liveLoading={liveLoading}
                  />
                </Suspense>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </AutoHeight>
    </section>
  );
};

export default NodeDisplay;
