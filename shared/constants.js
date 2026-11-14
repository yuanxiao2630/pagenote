/**
 * 页注 · PageNote — shared constants and small helpers.
 * Loaded before content.js and popup.js as a classic script.
 */
(() => {
  "use strict";

  const VERSION = "1.0.0";
  const STORAGE_PREFIX = "pagenote:v1:page:";

  const COLORS = {
    yellow: {
      key: "yellow",
      label: "琥珀黄",
      swatch: "#F4C84B",
      ink: "#A87209",
      highlight: "rgba(244, 200, 75, 0.42)",
      noteWash: "rgba(244, 200, 75, 0.16)",
    },
    green: {
      key: "green",
      label: "苔藓绿",
      swatch: "#91C49B",
      ink: "#477B56",
      highlight: "rgba(130, 190, 142, 0.34)",
      noteWash: "rgba(130, 190, 142, 0.14)",
    },
    blue: {
      key: "blue",
      label: "雾霭蓝",
      swatch: "#85B9DB",
      ink: "#2D6E96",
      highlight: "rgba(110, 170, 214, 0.32)",
      noteWash: "rgba(110, 170, 214, 0.13)",
    },
    pink: {
      key: "pink",
      label: "山茶粉",
      swatch: "#EAA3AE",
      ink: "#A34E60",
      highlight: "rgba(232, 146, 159, 0.30)",
      noteWash: "rgba(232, 146, 159, 0.12)",
    },
  };

  const COLOR_ORDER = ["yellow", "green", "blue", "pink"];

  const KIND_LABELS = {
    highlight: "高亮",
    underline: "下划线",
    note: "笔记",
  };

  function normalizeColor(value) {
    return Object.prototype.hasOwnProperty.call(COLORS, value) ? value : "yellow";
  }

  function pageStorageKey(url) {
    let normalized;
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      normalized = parsed.origin + parsed.pathname + parsed.search;
    } catch (_error) {
      normalized = String(url || "").split("#")[0];
    }
    return STORAGE_PREFIX + normalized;
  }

  function isPdfUrl(url) {
    try {
      const parsed = new URL(url);
      return /\.pdf$/i.test(parsed.pathname);
    } catch (_error) {
      return /\.pdf(?:$|[?#])/i.test(String(url || ""));
    }
  }

  function isSupportedPageUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:", "file:"].includes(parsed.protocol)) return false;
      if (parsed.protocol === "https:" && /(^|\.)chromewebstore\.google\.com$/i.test(parsed.hostname)) {
        return false;
      }
      if (parsed.protocol === "https:" && /(^|\.)chrome\.google\.com$/i.test(parsed.hostname) && parsed.pathname.startsWith("/webstore")) {
        return false;
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  function uid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return "pn_" + globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 18);
    }
    return "pn_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function relativeTime(timestamp) {
    const value = Number(timestamp);
    if (!Number.isFinite(value)) return "";
    const now = new Date();
    const date = new Date(value);
    const diff = now.getTime() - value;

    if (diff < 45 * 1000) return "刚刚";
    if (diff < 60 * 60 * 1000) return Math.max(1, Math.floor(diff / 60000)) + " 分钟前";

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });

    if (startOfDate === startOfToday) return "今天 " + time;
    if (startOfToday - startOfDate === 86400000) return "昨天 " + time;
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) + " " + time;
    }
    return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  }

  function kindLabel(kind) {
    return KIND_LABELS[kind] || "批注";
  }

  function colorLabel(color) {
    return COLORS[normalizeColor(color)].label;
  }

  function annotationStyleLabel(annotation) {
    const kind = annotation && annotation.kind;
    const color = annotation && annotation.color;
    if (kind === "note") return colorLabel(color) + "笔记";
    return colorLabel(color) + (kind === "underline" ? "下划线" : "高亮");
  }

  globalThis.PageNoteShared = {
    VERSION,
    STORAGE_PREFIX,
    COLORS,
    COLOR_ORDER,
    KIND_LABELS,
    normalizeColor,
    pageStorageKey,
    isPdfUrl,
    isSupportedPageUrl,
    uid,
    relativeTime,
    kindLabel,
    colorLabel,
    annotationStyleLabel,
  };
})();
