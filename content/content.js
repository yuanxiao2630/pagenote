/**
 * 页注 · PageNote — content script.
 *
 * Design notes:
 * - All UI lives in a closed-off shadow root; only a single fixed host is added to the page.
 * - Text marks are painted with the CSS Custom Highlight API, so page markup is never modified.
 * - Anchors combine a DOM path with the quoted text and surrounding context. If a page changes
 *   its DOM, the quote is re-located in the document text.
 */
(() => {
  "use strict";

  if (globalThis.__PAGENOTE_LOADED__) return;
  globalThis.__PAGENOTE_LOADED__ = true;

  const S = globalThis.PageNoteShared;
  const Styles = globalThis.PageNoteStyles;
  if (!S || !Styles) return;
  if (window.top !== window) return;

  const MAX_SELECTION_LENGTH = 4000;
  const MAX_NOTE_LENGTH = 2000;
  const PANEL_WIDTH = 370;

  const ICONS = {
    close:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    underline:
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M5 20h14"/></svg>',
    note:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5h9l5 5v10H5z"/><path d="M14 4.5v5h5"/><path d="M8.5 13h7M8.5 16h4.5"/></svg>',
    edit:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
    trash:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/></svg>',
    locate:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    lock:
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    marker:
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m15.5 4.5 4 4L8 20H4v-4L15.5 4.5Z"/><path d="m12.5 7.5 4 4"/><path d="M13 20h7"/></svg>',
  };

  const LOGO =
    '<svg class="pn-logo" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="#1c2c27"/><path d="M10 5h8l5 5v17H10a1.9 1.9 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="#faf4e5"/><path d="M18 5v4.5a1.5 1.5 0 0 0 1.5 1.5H23" fill="#e6dbc5"/><rect x="7" y="14.5" width="17" height="5.5" rx="1.5" fill="#f4c84b"/><path d="M12.5 22.5h7" stroke="#1c2c27" stroke-width="1.8" stroke-linecap="round" opacity=".5"/></svg>';

  const EMPTY_ART = `
    <svg class="pn-empty-art" viewBox="0 0 144 96" aria-hidden="true">
      <rect x="30" y="8" width="74" height="78" rx="8" fill="#FFFDF8" stroke="#E5DAC6" stroke-width="1.2"/>
      <rect x="41" y="22" width="34" height="4" rx="2" fill="#D9CEBC"/>
      <rect x="41" y="32" width="49" height="4" rx="2" fill="#EBE2D2"/>
      <rect x="21" y="44" width="88" height="16" rx="4" fill="#F4C84B" opacity=".5"/>
      <rect x="41" y="49" width="46" height="5" rx="2.5" fill="#6E5920" opacity=".72"/>
      <rect x="41" y="68" width="30" height="4" rx="2" fill="#E3D9C8"/>
      <g transform="translate(89 16)">
        <rect width="38" height="32" rx="7" fill="#1D2B26"/>
        <circle cx="9" cy="9" r="3" fill="#F4C84B"/>
        <path d="M9 17h20M9 22h13" stroke="#F7F1E4" stroke-width="2" stroke-linecap="round" opacity=".68"/>
        <path d="m33 20 4-4" stroke="#F4C84B" stroke-width="2" stroke-linecap="round"/>
      </g>
      <path d="M116 54c2.5 4.5 2.5 7.5 0 12" stroke="#D8CDBB" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"/>
    </svg>`;

  const state = {
    pageUrl: "",
    storageKey: "",
    annotations: [],
    ranges: new Map(),
    ready: false,
    loadToken: 0,
    sidebarOpen: false,
    filter: "all",
    selection: null,
    lastColor: "yellow",
    activeAnnotationId: null,
    composer: null,
    clearArmed: false,
    clearTimer: null,
    toastTimer: null,
    toastAction: null,
    toolbarFrame: 0,
    selectionTimer: null,
    retryTimers: [],
    mutationObserver: null,
    mutationTimer: null,
    saveQueue: Promise.resolve(),
    warnedNoHighlight: false,
    warnedStorage: false,
  };

  let host = null;
  let shadow = null;
  let ui = null;
  let locationTimer = null;
  let lastHref = "";

  // ── Tiny DOM helpers ───────────────────────────────────────────

  const normalizeSpace = (value) => String(value || "").replace(/\s+/g, " ").trim();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function shorten(value, limit) {
    const text = String(value || "");
    if (text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 1)).trimEnd() + "…";
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isReducedMotion() {
    return Boolean(globalThis.matchMedia && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function isExtensionUi(node) {
    if (!node) return false;
    try {
      return node.getRootNode() === shadow;
    } catch (_error) {
      return false;
    }
  }

  function eventTouchesUi(event) {
    if (!host) return false;
    return typeof event.composedPath === "function" && event.composedPath().includes(host);
  }

  // ── Chrome storage ─────────────────────────────────────────────

  function storageGet(key) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(key, (result) => {
          const error = chrome.runtime.lastError;
          if (error) {
            notifyStorageFailure();
            resolve({});
            return;
          }
          resolve(result || {});
        });
      } catch (_error) {
        notifyStorageFailure();
        resolve({});
      }
    });
  }

  function persistAnnotations() {
    const key = state.storageKey;
    if (!key) return;
    const snapshot = state.annotations.map((annotation) => clone(annotation));
    state.saveQueue = state.saveQueue
      .catch(() => {})
      .then(
        () =>
          new Promise((resolve) => {
            let settled = false;
            const finish = () => {
              if (!settled) {
                settled = true;
                resolve();
              }
            };
            try {
              chrome.storage.local.set({ [key]: snapshot }, () => {
                const error = chrome.runtime.lastError;
                if (error) notifyStorageFailure();
                finish();
              });
              setTimeout(finish, 1500);
            } catch (_error) {
              notifyStorageFailure();
              finish();
            }
          }),
      )
      .catch(() => {});
  }

  function notifyStorageFailure() {
    if (state.warnedStorage) return;
    state.warnedStorage = true;
    setTimeout(() => {
      showToast("批注保存失败，请刷新页面后重试", { tone: "danger", duration: 5200 });
    }, 200);
  }

  // ── Text anchors ───────────────────────────────────────────────

  function pointPath(node) {
    if (!node || !document.body) return null;
    if (node !== document.body && !document.body.contains(node)) return null;
    const parts = [];
    let current = node;
    while (current && current !== document.body) {
      const parent = current.parentNode;
      if (!parent) return null;
      const index = Array.prototype.indexOf.call(parent.childNodes, current);
      if (index < 0) return null;
      parts.unshift(index);
      current = parent;
    }
    if (current !== document.body) return null;
    return parts.join("/");
  }

  function resolvePath(path) {
    let node = document.body;
    if (!node) return null;
    if (!path) return node;
    const parts = String(path).split("/");
    for (const part of parts) {
      const index = Number(part);
      if (!Number.isInteger(index) || index < 0 || !node || !node.childNodes[index]) return null;
      node = node.childNodes[index];
    }
    return node;
  }

  function nodeLength(node) {
    if (!node) return 0;
    return node.nodeType === Node.TEXT_NODE ? node.nodeValue.length : node.childNodes.length;
  }

  function trimWhitespaceAtEdges(range) {
    const result = range.cloneRange();
    try {
      if (result.startContainer.nodeType === Node.TEXT_NODE) {
        const data = result.startContainer.nodeValue;
        let offset = result.startOffset;
        while (offset < data.length && /\s/.test(data[offset])) offset += 1;
        if (offset < data.length) result.setStart(result.startContainer, offset);
      }
      if (result.endContainer.nodeType === Node.TEXT_NODE) {
        const data = result.endContainer.nodeValue;
        let offset = result.endOffset;
        while (offset > 0 && /\s/.test(data[offset - 1])) offset -= 1;
        if (offset > 0) result.setEnd(result.endContainer, offset);
      }
    } catch (_error) {
      return range;
    }
    return result.collapsed ? range : result;
  }

  function serializeAnchor(range) {
    const startPath = pointPath(range.startContainer);
    const endPath = pointPath(range.endContainer);
    if (startPath === null || endPath === null) return null;

    const quote = normalizeSpace(range.toString());
    if (!quote) return null;

    let prefix = "";
    let suffix = "";
    try {
      const before = document.createRange();
      before.setStart(document.body, 0);
      before.setEnd(range.startContainer, range.startOffset);
      prefix = normalizeSpace(before.toString()).slice(-40);

      const after = document.createRange();
      after.setStart(range.endContainer, range.endOffset);
      after.setEnd(document.body, document.body.childNodes.length);
      suffix = normalizeSpace(after.toString()).slice(0, 40);
    } catch (_error) {
      // Context is a bonus, not a requirement.
    }

    return {
      quote,
      prefix,
      suffix,
      startPath,
      startOffset: range.startOffset,
      endPath,
      endOffset: range.endOffset,
    };
  }

  function rangeFromAnchorPaths(anchor) {
    if (!anchor) return null;
    const startNode = resolvePath(anchor.startPath);
    const endNode = resolvePath(anchor.endPath);
    if (!startNode || !endNode) return null;
    if (!document.body.contains(startNode) || !document.body.contains(endNode)) return null;

    try {
      const startOffset = clamp(Number(anchor.startOffset) || 0, 0, nodeLength(startNode));
      const endOffset = clamp(Number(anchor.endOffset) || 0, 0, nodeLength(endNode));
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      if (range.collapsed) return null;
      return range;
    } catch (_error) {
      return null;
    }
  }

  function quoteMatches(range, quote) {
    if (!range || !quote) return false;
    try {
      return normalizeSpace(range.toString()) === normalizeSpace(quote);
    } catch (_error) {
      return false;
    }
  }

  function buildTextIndex() {
    const nodes = [];
    const starts = [];
    const texts = [];
    let total = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, noscript, template, textarea, select, option")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest("[data-pagenote-root]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node = walker.nextNode();
    while (node) {
      nodes.push(node);
      starts.push(total);
      texts.push(node.nodeValue);
      total += node.nodeValue.length;
      node = walker.nextNode();
    }
    return { nodes, starts, text: texts.join("") };
  }

  function rangeFromTextOffsets(index, end, indexData) {
    const { nodes, starts, text } = indexData;
    if (!nodes.length) return null;
    const max = text.length;
    const from = clamp(index, 0, max);
    const to = clamp(end, 0, max);
    if (from >= to) return null;

    const start = boundaryInIndex(from, false, indexData);
    const finish = boundaryInIndex(to, true, indexData);
    if (!start || !finish) return null;
    try {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(finish.node, finish.offset);
      if (range.collapsed) return null;
      return range;
    } catch (_error) {
      return null;
    }
  }

  function boundaryInIndex(offset, isEnd, indexData) {
    const { nodes, starts } = indexData;
    if (!nodes.length) return null;
    if (offset <= 0) return { node: nodes[0], offset: 0 };
    const total = starts[starts.length - 1] + nodes[nodes.length - 1].nodeValue.length;
    if (offset >= total) {
      const last = nodes[nodes.length - 1];
      return { node: last, offset: last.nodeValue.length };
    }

    for (let i = 0; i < nodes.length; i += 1) {
      const start = starts[i];
      const length = nodes[i].nodeValue.length;
      const end = start + length;
      if (offset > start && offset < end) {
        return { node: nodes[i], offset: offset - start };
      }
      if (offset === start) {
        return { node: nodes[i], offset: 0 };
      }
      if (offset === end) {
        if (isEnd) return { node: nodes[i], offset: length };
        const next = nodes[i + 1];
        if (next) return { node: next, offset: 0 };
        return { node: nodes[i], offset: length };
      }
    }
    return null;
  }

  function contextScore(text, index, length, anchor) {
    const before = normalizeSpace(text.slice(Math.max(0, index - 90), index));
    const after = normalizeSpace(text.slice(index + length, index + length + 90));
    const prefix = normalizeSpace(anchor.prefix).slice(-30);
    const suffix = normalizeSpace(anchor.suffix).slice(0, 30);
    let score = 0;
    if (prefix && before.endsWith(prefix)) score += 20;
    if (suffix && after.startsWith(suffix)) score += 20;
    if (!prefix && !suffix) score += 1;
    return score;
  }

  function searchQuote(anchor, indexData) {
    const quote = normalizeSpace(anchor.quote);
    if (!quote) return null;
    const { text } = indexData;
    const candidates = [];
    let position = text.indexOf(quote);

    while (position >= 0 && candidates.length < 160) {
      candidates.push({ index: position, length: quote.length });
      position = text.indexOf(quote, position + Math.max(1, quote.length));
    }

    if (!candidates.length && /\s/.test(quote)) {
      const tokens = quote
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (tokens.length > 1) {
        try {
          const pattern = new RegExp(tokens.join("\\s+"), "g");
          let match = pattern.exec(text);
          while (match && candidates.length < 160) {
            candidates.push({ index: match.index, length: match[0].length });
            match = pattern.exec(text);
          }
        } catch (_error) {
          // Fall through to no match.
        }
      }
    }

    if (!candidates.length) {
      // Last resort: a whitespace-tolerant regular expression even for single-token quotes.
      const tokens = quote
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (tokens.length > 1) {
        try {
          const pattern = new RegExp(tokens.join("\\s+"), "g");
          let match = pattern.exec(text);
          while (match && candidates.length < 160) {
            candidates.push({ index: match.index, length: match[0].length });
            match = pattern.exec(text);
          }
        } catch (_error) {
          // Ignore.
        }
      }
    }

    if (!candidates.length) return null;

    let best = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const score = contextScore(text, candidate.index, candidate.length, anchor);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (!best) return null;
    return rangeFromTextOffsets(best.index, best.index + best.length, indexData);
  }

  function resolveAnchor(anchor, indexData) {
    if (!anchor || !anchor.quote) return null;
    const pathRange = rangeFromAnchorPaths(anchor);
    if (pathRange && quoteMatches(pathRange, anchor.quote)) return pathRange;
    const data = indexData || buildTextIndex();
    return searchQuote(anchor, data);
  }

  // ── Selection capture ──────────────────────────────────────────

  function isEditableContext(node) {
    if (!node) return false;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el || !el.closest) return false;
    return Boolean(
      el.closest(
        'input, textarea, select, option, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
      ),
    );
  }

  function readSelection() {
    if (!state.ready) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    let range;
    try {
      range = selection.getRangeAt(0).cloneRange();
    } catch (_error) {
      return null;
    }
    if (!range || !document.body) return null;
    if (!document.body.contains(range.commonAncestorContainer)) return null;
    if (range.startContainer.getRootNode() !== document && range.startContainer.getRootNode() !== document.documentElement) {
      return null;
    }
    if (isEditableContext(range.startContainer) || isEditableContext(range.endContainer)) return null;

    const trimmed = trimWhitespaceAtEdges(range);
    const text = normalizeSpace(trimmed.toString());
    if (!text) return null;
    if (text.length > MAX_SELECTION_LENGTH) {
      showToast(`一次最多标注 ${MAX_SELECTION_LENGTH} 个字，请缩短选区`, { tone: "danger" });
      return null;
    }

    const anchor = serializeAnchor(trimmed);
    if (!anchor) return null;
    return { range: trimmed, anchor, text };
  }

  function clearNativeSelection() {
    try {
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
    } catch (_error) {
      // Nothing to clear.
    }
  }

  // ── Building the shadow UI ─────────────────────────────────────

  function buildSwatches(className, actionName) {
    return S.COLOR_ORDER.map((color, index) => {
      const info = S.COLORS[color];
      return `<button type="button" class="${className}" style="--pn-swatch:${info.swatch}" data-action="${actionName}" data-color="${color}" title="${info.label}高亮${index < 4 ? `（${index + 1}）` : ""}" aria-label="${info.label}高亮"><span class="pn-swatch-fill"></span></button>`;
    }).join("");
  }

  function buildComposerPalette() {
    return S.COLOR_ORDER.map(
      (color) =>
        `<button type="button" class="pn-palette-dot" style="--pn-swatch:${S.COLORS[color].swatch}" data-action="compose-color" data-color="${color}" title="${S.COLORS[color].label}" aria-label="${S.COLORS[color].label}" aria-pressed="false"></button>`,
    ).join("");
  }

  function buildUI() {
    if (host || !document.documentElement) return false;

    // A previous content-script instance can linger after an extension reload.
    // Remove its host so on-demand injection never stacks two UIs.
    document.querySelectorAll("pagenote-root[data-pagenote-root]").forEach((node) => {
      try {
        node.remove();
      } catch (_error) {
        // Ignore.
      }
    });

    host = document.createElement("pagenote-root");
    host.setAttribute("data-pagenote-root", "");
    host.style.cssText = [
      "all: initial !important",
      "display: block !important",
      "position: fixed !important",
      "inset: 0 !important",
      "width: 100vw !important",
      "height: 100vh !important",
      "z-index: 2147483647 !important",
      "pointer-events: none !important",
      "color-scheme: light !important",
    ].join("; ");

    shadow = host.attachShadow({ mode: "open" });
    installShadowStyles();

    const wrapper = document.createElement("div");
    wrapper.className = "pn-ui";
    wrapper.innerHTML = `
      <div class="pn-selection" hidden>
        <div class="pn-toolbar" role="toolbar" aria-label="页注批注工具">
          <div class="pn-swatches" role="group" aria-label="高亮颜色">
            ${buildSwatches("pn-swatch", "highlight")}
          </div>
          <span class="pn-divider" aria-hidden="true"></span>
          <button type="button" class="pn-tool" data-action="underline" title="添加下划线（U）" aria-label="添加下划线" aria-keyshortcuts="U">
            ${ICONS.underline}<span>下划线</span>
          </button>
          <button type="button" class="pn-tool pn-tool-note" data-action="note" title="添加一条笔记（N）" aria-label="添加笔记" aria-keyshortcuts="N">
            ${ICONS.note}<span>笔记</span>
          </button>
          <span class="pn-divider" aria-hidden="true"></span>
          <button type="button" class="pn-toolbar-close" data-action="dismiss" title="关闭工具条（Esc）" aria-label="关闭工具条">
            ${ICONS.close}
          </button>
        </div>
      </div>

      <button type="button" class="pn-edge" hidden aria-label="打开页注批注栏" title="打开批注栏">
        <span class="pn-edge-icon" aria-hidden="true">${ICONS.marker}</span>
        <span class="pn-edge-count">0</span>
        <span class="pn-edge-label">批注</span>
      </button>

      <aside class="pn-panel" aria-label="页注批注栏" aria-hidden="true" inert>
        <header class="pn-panel-head">
          <div class="pn-brand-row">
            <div class="pn-brand">
              ${LOGO}
              <div class="pn-brand-copy">
                <span class="pn-brand-name">页注</span>
                <span class="pn-brand-en">PAGENOTE</span>
              </div>
            </div>
            <button type="button" class="pn-icon-btn pn-panel-close" data-action="close-panel" title="关闭批注栏" aria-label="关闭批注栏">
              ${ICONS.close}
            </button>
          </div>
          <div class="pn-panel-title-row">
            <div>
              <h2>本页批注</h2>
              <p class="pn-page-host"></p>
            </div>
            <span class="pn-total"><b>0</b><span>条</span></span>
          </div>
        </header>

        <section class="pn-composer" aria-label="临时笔记" hidden>
          <div class="pn-composer-head">
            <span class="pn-composer-kicker">临时笔记</span>
            <button type="button" class="pn-composer-close" data-action="cancel-note" title="关闭笔记" aria-label="关闭笔记">
              ${ICONS.close}
            </button>
          </div>
          <blockquote class="pn-composer-quote"></blockquote>
          <textarea maxlength="${MAX_NOTE_LENGTH}" placeholder="写下此刻的想法…" aria-label="笔记内容"></textarea>
          <div class="pn-composer-tools">
            <div class="pn-palette" role="group" aria-label="标记颜色">
              <span class="pn-palette-label">标记色</span>
              ${buildComposerPalette()}
            </div>
            <span class="pn-counter">0 / ${MAX_NOTE_LENGTH}</span>
          </div>
          <div class="pn-composer-actions">
            <button type="button" class="pn-btn pn-btn-ghost" data-action="cancel-note">取消</button>
            <button type="button" class="pn-btn pn-btn-primary" data-action="save-note" title="⌘/Ctrl + Enter 保存">保存批注</button>
          </div>
        </section>

        <div class="pn-filter-bar">
          <div class="pn-filters" role="group" aria-label="筛选批注">
            <button type="button" class="pn-filter" data-action="filter" data-filter="all" aria-pressed="true">全部 <span class="pn-filter-count" data-count="all">0</span></button>
            <button type="button" class="pn-filter" data-action="filter" data-filter="marks" aria-pressed="false">标记 <span class="pn-filter-count" data-count="marks">0</span></button>
            <button type="button" class="pn-filter" data-action="filter" data-filter="notes" aria-pressed="false">笔记 <span class="pn-filter-count" data-count="notes">0</span></button>
          </div>
        </div>

        <div class="pn-list" role="list"></div>

        <footer class="pn-panel-foot">
          <span class="pn-local">${ICONS.lock}<span>仅保存在此浏览器</span></span>
          <button type="button" class="pn-clear" data-action="clear-all" hidden>清除本页</button>
        </footer>
      </aside>

      <div class="pn-flash-layer" aria-hidden="true"></div>

      <div class="pn-toast" role="status" aria-live="polite" hidden>
        <span class="pn-toast-dot" aria-hidden="true"></span>
        <span class="pn-toast-message"></span>
        <button type="button" class="pn-toast-action" hidden></button>
        <button type="button" class="pn-toast-close" aria-label="关闭提示">${ICONS.close}</button>
      </div>
    `;

    shadow.appendChild(wrapper);

    ui = {
      root: wrapper,
      selection: wrapper.querySelector(".pn-selection"),
      toolbar: wrapper.querySelector(".pn-toolbar"),
      edge: wrapper.querySelector(".pn-edge"),
      edgeCount: wrapper.querySelector(".pn-edge-count"),
      panel: wrapper.querySelector(".pn-panel"),
      panelClose: wrapper.querySelector(".pn-panel-close"),
      pageHost: wrapper.querySelector(".pn-page-host"),
      total: wrapper.querySelector(".pn-total b"),
      composer: wrapper.querySelector(".pn-composer"),
      composerKicker: wrapper.querySelector(".pn-composer-kicker"),
      composerQuote: wrapper.querySelector(".pn-composer-quote"),
      composerTextarea: wrapper.querySelector(".pn-composer textarea"),
      composerCounter: wrapper.querySelector(".pn-counter"),
      composerSave: wrapper.querySelector('[data-action="save-note"]'),
      composerCancel: wrapper.querySelector('.pn-btn-ghost[data-action="cancel-note"]'),
      list: wrapper.querySelector(".pn-list"),
      clear: wrapper.querySelector(".pn-clear"),
      flashLayer: wrapper.querySelector(".pn-flash-layer"),
      toast: wrapper.querySelector(".pn-toast"),
      toastMessage: wrapper.querySelector(".pn-toast-message"),
      toastDot: wrapper.querySelector(".pn-toast-dot"),
      toastAction: wrapper.querySelector(".pn-toast-action"),
      toastClose: wrapper.querySelector(".pn-toast-close"),
      filters: Array.from(wrapper.querySelectorAll(".pn-filter")),
      countNodes: Array.from(wrapper.querySelectorAll("[data-count]")),
      palette: Array.from(wrapper.querySelectorAll(".pn-palette-dot")),
    };

    document.documentElement.appendChild(host);
    installHighlightStyles();
    bindUiEvents();
    bindPageEvents();
    return true;
  }

  function installShadowStyles() {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(Styles.SHADOW_CSS);
      shadow.adoptedStyleSheets = [sheet];
    } catch (_error) {
      const style = document.createElement("style");
      style.textContent = Styles.SHADOW_CSS;
      shadow.appendChild(style);
    }
  }

  const supportsHighlightApi = () =>
    Boolean(globalThis.CSS && CSS.highlights && typeof globalThis.Highlight === "function");

  function installHighlightStyles() {
    if (!supportsHighlightApi()) return;
    let css = "";
    for (const key of S.COLOR_ORDER) {
      const color = S.COLORS[key];
      css += `::highlight(pn-highlight-${key}) { background-color: ${color.highlight}; }\n`;
      css += `::highlight(pn-underline-${key}) { text-decoration-line: underline; text-decoration-color: ${color.ink}; text-decoration-thickness: 2px; text-underline-offset: 3px; }\n`;
      css += `::highlight(pn-note-${key}) { background-color: ${color.noteWash}; text-decoration-line: underline; text-decoration-style: dotted; text-decoration-color: ${color.ink}; text-decoration-thickness: 1.5px; text-underline-offset: 3px; }\n`;
    }
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    } catch (_error) {
      const style = document.createElement("style");
      style.setAttribute("data-pagenote-highlight-style", "");
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  // ── Highlight rendering ────────────────────────────────────────

  function renderHighlights() {
    if (!supportsHighlightApi()) {
      if (state.annotations.length && !state.warnedNoHighlight) {
        state.warnedNoHighlight = true;
        showToast("当前浏览器不支持网页高亮，请升级 Chrome 或 Edge", { tone: "danger", duration: 5200 });
      }
      return;
    }

    const registry = CSS.highlights;
    for (const name of Array.from(registry.keys())) {
      if (name.startsWith("pn-")) registry.delete(name);
    }

    const annotationById = new Map(state.annotations.map((annotation) => [annotation.id, annotation]));
    const groups = new Map();

    for (const [id, range] of state.ranges) {
      const annotation = annotationById.get(id);
      if (!annotation) continue;
      try {
        if (!range.startContainer.isConnected || !range.endContainer.isConnected) continue;
      } catch (_error) {
        continue;
      }
      const name = `pn-${annotation.kind}-${annotation.color}`;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(range);
    }

    for (const [name, ranges] of groups) {
      try {
        registry.set(name, new Highlight(...ranges));
      } catch (_error) {
        // Ignore malformed ranges.
      }
    }
  }

  function restoreRanges({ renderPanelNow = true } = {}) {
    state.ranges.clear();
    let indexData = null;

    for (const annotation of state.annotations) {
      const pathRange = rangeFromAnchorPaths(annotation.anchor);
      if (pathRange && quoteMatches(pathRange, annotation.anchor.quote)) {
        state.ranges.set(annotation.id, pathRange);
        continue;
      }
      if (!indexData) indexData = buildTextIndex();
      const found = searchQuote(annotation.anchor, indexData);
      if (found) state.ranges.set(annotation.id, found);
    }

    renderHighlights();
    if (renderPanelNow) renderPanel();
    updateEdgeTab();
    if (state.annotations.some((annotation) => !state.ranges.has(annotation.id))) {
      startMutationObserver();
    } else {
      stopMutationObserver();
    }
  }

  function unresolvedCount() {
    return state.annotations.reduce((count, annotation) => count + (state.ranges.has(annotation.id) ? 0 : 1), 0);
  }

  function scheduleRestoreRetries() {
    for (const timer of state.retryTimers) clearTimeout(timer);
    state.retryTimers = [];
    for (const delay of [450, 1400, 3200, 6800]) {
      const timer = setTimeout(() => {
        if (!state.ready) return;
        if (unresolvedCount() > 0) restoreRanges();
      }, delay);
      state.retryTimers.push(timer);
    }
  }

  function startMutationObserver() {
    if (state.mutationObserver || !document.body) return;
    const startedAt = Date.now();
    state.mutationObserver = new MutationObserver(() => {
      if (!state.ready || Date.now() - startedAt > 20000) {
        stopMutationObserver();
        return;
      }
      clearTimeout(state.mutationTimer);
      state.mutationTimer = setTimeout(() => {
        if (state.ready && unresolvedCount() > 0) restoreRanges();
        else stopMutationObserver();
      }, 700);
    });
    try {
      state.mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (_error) {
      stopMutationObserver();
    }
  }

  function stopMutationObserver() {
    if (state.mutationObserver) {
      state.mutationObserver.disconnect();
      state.mutationObserver = null;
    }
    clearTimeout(state.mutationTimer);
    state.mutationTimer = null;
  }

  // ── Page loading and annotation state ──────────────────────────

  function normalizeAnchor(anchor) {
    if (!anchor || typeof anchor !== "object") return null;
    if (typeof anchor.quote !== "string" || !anchor.quote) return null;
    return {
      quote: anchor.quote,
      prefix: typeof anchor.prefix === "string" ? anchor.prefix : "",
      suffix: typeof anchor.suffix === "string" ? anchor.suffix : "",
      startPath: typeof anchor.startPath === "string" ? anchor.startPath : "0",
      startOffset: Number.isFinite(Number(anchor.startOffset)) ? Number(anchor.startOffset) : 0,
      endPath: typeof anchor.endPath === "string" ? anchor.endPath : "0",
      endOffset: Number.isFinite(Number(anchor.endOffset)) ? Number(anchor.endOffset) : 0,
    };
  }

  function normalizeList(raw) {
    if (!Array.isArray(raw)) return [];
    const ids = new Set();
    return raw
      .filter((item) => item && typeof item === "object" && typeof item.id === "string")
      .map((item) => {
        const kind = ["highlight", "underline", "note"].includes(item.kind) ? item.kind : "highlight";
        const anchor = normalizeAnchor(item.anchor);
        if (!anchor) return null;
        return {
          id: item.id,
          kind,
          color: S.normalizeColor(item.color),
          note: typeof item.note === "string" ? item.note.slice(0, MAX_NOTE_LENGTH) : "",
          anchor,
          createdAt: Number(item.createdAt) || Date.now(),
          updatedAt: Number(item.updatedAt) || Number(item.createdAt) || Date.now(),
        };
      })
      .filter((item) => {
        if (!item || ids.has(item.id)) return false;
        ids.add(item.id);
        return true;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async function loadPage() {
    const token = ++state.loadToken;
    state.ready = false;
    state.pageUrl = location.href.split("#")[0];
    state.storageKey = S.pageStorageKey(location.href);
    state.annotations = [];
    state.ranges.clear();
    state.activeAnnotationId = null;
    state.clearArmed = false;
    updateClearButton();
    renderHighlights();
    renderPanel();
    updateEdgeTab();
    cancelComposer(true);

    let stored = {};
    try {
      stored = await storageGet(state.storageKey);
    } catch (_error) {
      stored = {};
    }
    if (token !== state.loadToken) return;

    state.annotations = normalizeList(stored[state.storageKey]);
    state.ready = true;
    restoreRanges();
    scheduleRestoreRetries();
  }

  // ── Panel rendering ────────────────────────────────────────────

  const filters = {
    all: () => true,
    marks: (annotation) => annotation.kind !== "note",
    notes: (annotation) => annotation.kind === "note",
  };

  function pageHostLabel() {
    if (location.protocol === "file:") return "本地文件";
    return location.hostname.replace(/^www\./i, "") || location.hostname;
  }

  function counts() {
    return {
      all: state.annotations.length,
      marks: state.annotations.filter((annotation) => annotation.kind !== "note").length,
      notes: state.annotations.filter((annotation) => annotation.kind === "note").length,
    };
  }

  function makeEmptyState() {
    const wrap = element("div", "pn-empty");
    wrap.innerHTML = EMPTY_ART;
    const hasAny = state.annotations.length > 0;
    const heading = element("h3", "", hasAny ? "这里还没有内容" : "还没有批注");
    const paragraph = element(
      "p",
      "",
      hasAny
        ? "换一个筛选条件，或回到「全部」查看本页的所有标记。"
        : "选中网页中的一段文字，就可以高亮、划线，或把想法写进右侧的临时笔记。",
    );
    wrap.append(heading, paragraph);
    return wrap;
  }

  function buildCard(annotation) {
    const color = S.COLORS[annotation.color];
    const hasRange = state.ranges.has(annotation.id);
    const card = element("article", "pn-card");
    card.dataset.id = annotation.id;
    card.dataset.kind = annotation.kind;
    card.setAttribute("role", "listitem");
    card.tabIndex = 0;
    card.style.setProperty("--pn-card-accent", color.swatch);
    card.style.setProperty("--pn-card-wash", color.noteWash);
    if (state.activeAnnotationId === annotation.id) card.classList.add("is-active");
    card.title = hasRange ? "点击定位到原文" : "原文位置已变化";

    const meta = element("div", "pn-card-meta");
    meta.append(
      element("span", "pn-card-dot"),
      element("span", "pn-card-kind", S.annotationStyleLabel(annotation)),
      element("span", "pn-card-time", S.relativeTime(annotation.updatedAt || annotation.createdAt)),
    );

    const actions = element("div", "pn-card-actions");
    if (hasRange) {
      const locate = element("button", "pn-card-action");
      locate.type = "button";
      locate.dataset.action = "locate";
      locate.title = "定位到原文";
      locate.setAttribute("aria-label", "定位到原文");
      locate.innerHTML = ICONS.locate;
      actions.append(locate);
    }
    if (annotation.kind === "note") {
      const edit = element("button", "pn-card-action");
      edit.type = "button";
      edit.dataset.action = "edit";
      edit.title = "编辑笔记";
      edit.setAttribute("aria-label", "编辑笔记");
      edit.innerHTML = ICONS.edit;
      actions.append(edit);
    }
    const remove = element("button", "pn-card-action is-delete");
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.title = "删除批注";
    remove.setAttribute("aria-label", "删除批注");
    remove.innerHTML = ICONS.trash;
    actions.append(remove);

    card.append(meta, actions);

    if (annotation.anchor.quote) {
      card.append(element("p", "pn-card-quote", annotation.anchor.quote));
    }
    if (annotation.note) {
      card.append(element("p", "pn-card-note", annotation.note));
    }
    if (!hasRange) {
      card.append(element("span", "pn-orphan", "原文位置已变化"));
    }
    return card;
  }

  function renderPanel() {
    if (!ui) return;
    const oldScroll = ui.list.scrollTop;
    const current = counts();
    ui.pageHost.textContent = pageHostLabel();
    ui.pageHost.title = document.title || location.href;
    ui.total.textContent = String(current.all);

    for (const button of ui.filters) {
      const active = button.dataset.filter === state.filter;
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    for (const node of ui.countNodes) {
      const key = node.dataset.count;
      node.textContent = String(current[key] || 0);
    }

    const predicate = filters[state.filter] || filters.all;
    const visible = state.annotations.filter(predicate);
    const fragment = document.createDocumentFragment();
    if (!visible.length) {
      fragment.append(makeEmptyState());
    } else {
      for (const annotation of visible) {
        fragment.append(buildCard(annotation));
      }
    }
    ui.list.replaceChildren(fragment);
    ui.list.scrollTop = oldScroll;

    ui.clear.hidden = current.all === 0;
    updateClearButton();

    if (state.activeAnnotationId) {
      const active = Array.from(ui.list.querySelectorAll(".pn-card")).find(
        (card) => card.dataset.id === state.activeAnnotationId,
      );
      if (active) {
        requestAnimationFrame(() => ensureCardVisible(active));
      }
    }
  }

  function ensureCardVisible(card) {
    if (!card || !ui) return;
    const cardRect = card.getBoundingClientRect();
    const listRect = ui.list.getBoundingClientRect();
    if (cardRect.top < listRect.top + 2) {
      ui.list.scrollTop -= listRect.top - cardRect.top + 4;
    } else if (cardRect.bottom > listRect.bottom - 2) {
      ui.list.scrollTop += cardRect.bottom - listRect.bottom + 4;
    }
  }

  // ── Panel open / close ─────────────────────────────────────────

  function openPanel({ focusCardId = null, focusPanel = false } = {}) {
    if (!ui) return;
    state.sidebarOpen = true;
    if (focusCardId) {
      state.activeAnnotationId = focusCardId;
      state.filter = "all";
    }
    ui.panel.classList.add("is-open");
    ui.panel.removeAttribute("inert");
    ui.panel.setAttribute("aria-hidden", "false");
    ui.root.classList.add("has-panel");
    renderPanel();
    updateEdgeTab();
    if (focusCardId) {
      const card = Array.from(ui.list.querySelectorAll(".pn-card")).find(
        (item) => item.dataset.id === focusCardId,
      );
      if (card) requestAnimationFrame(() => ensureCardVisible(card));
    }
    if (focusPanel) {
      setTimeout(() => {
        if (state.sidebarOpen && !state.composer) ui.panelClose.focus({ preventScroll: true });
      }, 180);
    }
  }

  function closePanel({ moveFocus = false } = {}) {
    if (!ui) return;
    state.sidebarOpen = false;
    ui.panel.classList.remove("is-open");
    ui.panel.setAttribute("inert", "");
    ui.panel.setAttribute("aria-hidden", "true");
    ui.root.classList.remove("has-panel");
    state.activeAnnotationId = null;
    updateEdgeTab();
    if (moveFocus && !ui.edge.hidden) {
      try {
        ui.edge.focus({ preventScroll: true });
      } catch (_error) {
        // Ignore.
      }
    }
  }

  function handlePanelClose() {
    if (state.composer) {
      const closed = requestCloseComposer();
      if (!closed) return;
    }
    closePanel({ moveFocus: true });
  }

  function updateEdgeTab() {
    if (!ui) return;
    const total = state.annotations.length;
    const visible = total > 0 && !state.sidebarOpen && ui.selection.hidden;
    ui.edge.hidden = !visible;
    ui.edgeCount.textContent = total > 99 ? "99+" : String(total);
    ui.edge.setAttribute("aria-label", `打开页注批注栏，共 ${total} 条批注`);
    ui.edge.title = `打开批注栏（${total} 条）`;
  }

  // ── Floating toolbar ───────────────────────────────────────────

  function selectionRect(range) {
    let rects = [];
    try {
      rects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.top < innerHeight,
      );
    } catch (_error) {
      rects = [];
    }
    if (rects.length) return rects[0];
    try {
      return range.getBoundingClientRect();
    } catch (_error) {
      return null;
    }
  }

  function showToolbar(snapshot) {
    if (!ui || !snapshot) return;
    state.selection = snapshot;
    ui.selection.hidden = false;
    ui.toolbar.classList.remove("is-visible");
    const anchorRect = selectionRect(snapshot.range);
    if (!anchorRect || (!anchorRect.width && !anchorRect.height)) {
      hideToolbar();
      return;
    }

    const toolbarWidth = ui.toolbar.offsetWidth || 292;
    const toolbarHeight = ui.toolbar.offsetHeight || 40;
    const viewportWidth = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth);
    const availableRight =
      viewportWidth - (state.sidebarOpen ? Math.min(PANEL_WIDTH, viewportWidth) : 0) - 10;
    const maxLeft = Math.max(10, availableRight - toolbarWidth);

    // Use the union box for horizontal centring (a drop cap can make the first
    // client rect much narrower and skew the toolbar to the left), but use the
    // first line rect for vertical placement so the toolbar stays near the text.
    let anchorBox = anchorRect;
    try {
      const box = snapshot.range.getBoundingClientRect();
      if (box && Number.isFinite(box.left) && box.width > 0) anchorBox = box;
    } catch (_error) {
      anchorBox = anchorRect;
    }

    let left = anchorBox.left + anchorBox.width / 2 - toolbarWidth / 2;
    left = clamp(left, 10, maxLeft);
    let top = anchorRect.top - toolbarHeight - 11;
    if (top < 10) top = anchorRect.bottom + 11;
    top = clamp(top, 10, Math.max(10, innerHeight - toolbarHeight - 10));

    ui.toolbar.style.left = `${Math.round(left)}px`;
    ui.toolbar.style.top = `${Math.round(top)}px`;
    updateEdgeTab();

    const revealToolbar = () => {
      if (state.selection === snapshot) ui.toolbar.classList.add("is-visible");
    };
    cancelAnimationFrame(state.toolbarFrame);
    state.toolbarFrame = requestAnimationFrame(revealToolbar);
    // rAF can be paused in background tabs; the timeout keeps the toolbar
    // painted as soon as the user returns to this tab.
    setTimeout(revealToolbar, 60);
  }

  function hideToolbar() {
    if (!ui) return;
    state.selection = null;
    ui.selection.hidden = true;
    ui.toolbar.classList.remove("is-visible");
    cancelAnimationFrame(state.toolbarFrame);
    updateEdgeTab();
  }

  function refreshSelectionToolbar() {
    if (!state.ready || state.composer) return;
    const snapshot = readSelection();
    if (snapshot) showToolbar(snapshot);
    else if (!ui.selection.hidden) hideToolbar();
  }

  // ── Creating and removing annotations ──────────────────────────

  function ensureReady() {
    if (state.ready) return true;
    showToast("批注正在载入，请稍等一下");
    return false;
  }

  function duplicateExists(kind, color, anchor) {
    return state.annotations.some(
      (annotation) =>
        annotation.kind === kind &&
        annotation.color === color &&
        annotation.anchor.quote === anchor.quote &&
        annotation.anchor.startPath === anchor.startPath &&
        annotation.anchor.startOffset === anchor.startOffset,
    );
  }

  function applyHighlight(color, snapshot) {
    if (!ensureReady()) return false;
    if (state.composer) {
      showToast("请先完成当前的临时笔记");
      return false;
    }
    const selection = snapshot || state.selection || readSelection();
    if (!selection) {
      showToast("先选中一段文字，再标记");
      return false;
    }
    const normalizedColor = S.normalizeColor(color);
    if (duplicateExists("highlight", normalizedColor, selection.anchor)) {
      showToast("这段文字已经用同一种颜色高亮过了");
      hideToolbar();
      return false;
    }

    const now = Date.now();
    const annotation = {
      id: S.uid(),
      kind: "highlight",
      color: normalizedColor,
      note: "",
      anchor: selection.anchor,
      createdAt: now,
      updatedAt: now,
    };
    state.annotations.unshift(annotation);
    try {
      state.ranges.set(annotation.id, selection.range.cloneRange());
    } catch (_error) {
      // The retry pass will resolve it from the anchor.
    }
    state.lastColor = normalizedColor;
    state.activeAnnotationId = null;
    persistAnnotations();
    renderHighlights();
    renderPanel();
    updateEdgeTab();
    hideToolbar();
    clearNativeSelection();
    showToast(`已添加${S.COLORS[normalizedColor].label}高亮`, {
      actionLabel: "撤销",
      onAction: () => {
        removeAnnotation(annotation.id, { notify: false });
        showToast("已撤销高亮");
      },
      tone: "accent",
    });
    return true;
  }

  function applyUnderline(color, snapshot) {
    if (!ensureReady()) return false;
    if (state.composer) {
      showToast("请先完成当前的临时笔记");
      return false;
    }
    const selection = snapshot || state.selection || readSelection();
    if (!selection) {
      showToast("先选中一段文字，再添加下划线");
      return false;
    }
    const normalizedColor = S.normalizeColor(color);
    if (duplicateExists("underline", normalizedColor, selection.anchor)) {
      showToast("这段文字已经添加过下划线了");
      hideToolbar();
      return false;
    }
    const now = Date.now();
    const annotation = {
      id: S.uid(),
      kind: "underline",
      color: normalizedColor,
      note: "",
      anchor: selection.anchor,
      createdAt: now,
      updatedAt: now,
    };
    state.annotations.unshift(annotation);
    try {
      state.ranges.set(annotation.id, selection.range.cloneRange());
    } catch (_error) {
      // Retry from the stored anchor.
    }
    state.lastColor = normalizedColor;
    state.activeAnnotationId = null;
    persistAnnotations();
    renderHighlights();
    renderPanel();
    updateEdgeTab();
    hideToolbar();
    clearNativeSelection();
    showToast("已添加下划线", {
      actionLabel: "撤销",
      onAction: () => {
        removeAnnotation(annotation.id, { notify: false });
        showToast("已撤销下划线");
      },
      tone: "accent",
    });
    return true;
  }

  function removeAnnotation(id, { notify = true } = {}) {
    const index = state.annotations.findIndex((annotation) => annotation.id === id);
    if (index < 0) return null;
    const removed = state.annotations[index];
    if (state.composer && state.composer.editingId === id) closeComposer(true);
    state.annotations.splice(index, 1);
    state.ranges.delete(id);
    if (state.activeAnnotationId === id) state.activeAnnotationId = null;
    persistAnnotations();
    renderHighlights();
    renderPanel();
    updateEdgeTab();
    if (notify) {
      showToast("已删除批注", {
        actionLabel: "撤销",
        onAction: () => restoreAnnotations([removed]),
        tone: "danger",
      });
    }
    return removed;
  }

  function restoreAnnotations(removed) {
    if (!Array.isArray(removed) || !removed.length) return;
    for (const annotation of removed) {
      if (!state.annotations.some((item) => item.id === annotation.id)) {
        state.annotations.push(annotation);
      }
    }
    state.annotations.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    restoreRanges();
    persistAnnotations();
    showToast(removed.length > 1 ? "已恢复批注" : "已恢复批注");
  }

  function updateClearButton() {
    if (!ui) return;
    if (state.annotations.length === 0) {
      state.clearArmed = false;
      clearTimeout(state.clearTimer);
      ui.clear.classList.remove("is-armed");
      ui.clear.textContent = "清除本页";
      return;
    }
    if (state.clearArmed) {
      ui.clear.classList.add("is-armed");
      ui.clear.textContent = "再次点击确认";
    } else {
      ui.clear.classList.remove("is-armed");
      ui.clear.textContent = "清除本页";
    }
  }

  function handleClearAll() {
    if (!state.annotations.length) return;
    if (!state.clearArmed) {
      state.clearArmed = true;
      updateClearButton();
      clearTimeout(state.clearTimer);
      state.clearTimer = setTimeout(() => {
        state.clearArmed = false;
        updateClearButton();
      }, 3200);
      return;
    }

    clearTimeout(state.clearTimer);
    state.clearArmed = false;
    const removed = state.annotations.slice();
    state.annotations = [];
    state.ranges.clear();
    state.activeAnnotationId = null;
    if (state.composer) closeComposer(true);
    persistAnnotations();
    renderHighlights();
    renderPanel();
    updateEdgeTab();
    showToast(`已清除 ${removed.length} 条批注`, {
      actionLabel: "撤销",
      onAction: () => restoreAnnotations(removed),
      tone: "danger",
    });
  }

  // ── Note composer ──────────────────────────────────────────────

  function startComposer({ mode, annotation = null, anchor, quote, color, range }) {
    if (!ui || !anchor) return false;
    if (state.composer) {
      showToast("请先完成当前的临时笔记");
      return false;
    }
    const initialColor = S.normalizeColor(color || state.lastColor);
    state.composer = {
      mode,
      editingId: annotation ? annotation.id : null,
      anchor: clone(anchor),
      range: range || null,
      color: initialColor,
      originalColor: initialColor,
      originalNote: annotation ? annotation.note : "",
      discardArmed: false,
      discardTimer: null,
    };
    state.lastColor = initialColor;

    ui.composer.classList.remove("is-invalid");
    ui.composer.hidden = false;
    ui.composerKicker.textContent = mode === "edit" ? "编辑笔记" : "临时笔记";
    ui.composerQuote.textContent = shorten(quote || anchor.quote, 260);
    ui.composerTextarea.value = annotation ? annotation.note : "";
    ui.composerTextarea.setAttribute("aria-label", mode === "edit" ? "编辑笔记内容" : "笔记内容");
    ui.composerSave.textContent = mode === "edit" ? "保存修改" : "保存批注";
    resetDiscardArm();
    setComposerColor(initialColor, false);
    updateComposerCounter();
    setTimeout(
      () => {
        if (!state.composer) return;
        try {
          ui.composerTextarea.focus({ preventScroll: true });
          ui.composerTextarea.setSelectionRange(ui.composerTextarea.value.length, ui.composerTextarea.value.length);
        } catch (_error) {
          // Focus can fail on restricted pages.
        }
      },
      isReducedMotion() ? 30 : 220,
    );
    return true;
  }

  function setComposerColor(color, markDirty = true) {
    if (!state.composer) return;
    const normalized = S.normalizeColor(color);
    state.composer.color = normalized;
    state.lastColor = normalized;
    ui.composer.style.setProperty("--pn-composer-accent", S.COLORS[normalized].swatch);
    for (const dot of ui.palette) {
      dot.setAttribute("aria-pressed", dot.dataset.color === normalized ? "true" : "false");
      dot.classList.toggle("is-selected", dot.dataset.color === normalized);
    }
    if (markDirty) resetDiscardArm();
  }

  function updateComposerCounter() {
    if (!ui) return;
    ui.composerCounter.textContent = `${ui.composerTextarea.value.length} / ${MAX_NOTE_LENGTH}`;
  }

  function isComposerDirty() {
    if (!state.composer) return false;
    const value = ui.composerTextarea.value.trim();
    if (state.composer.mode === "new") return value.length > 0;
    return value !== state.composer.originalNote.trim() || state.composer.color !== state.composer.originalColor;
  }

  function resetDiscardArm() {
    if (!state.composer) return;
    state.composer.discardArmed = false;
    clearTimeout(state.composer.discardTimer);
    state.composer.discardTimer = null;
    ui.composerCancel.textContent = "取消";
    ui.composerCancel.classList.remove("is-danger");
  }

  function armDiscard() {
    if (!state.composer) return;
    state.composer.discardArmed = true;
    ui.composerCancel.textContent = "确认放弃";
    ui.composerCancel.classList.add("is-danger");
    clearTimeout(state.composer.discardTimer);
    state.composer.discardTimer = setTimeout(() => {
      if (state.composer) resetDiscardArm();
    }, 3200);
  }

  function requestCloseComposer() {
    if (!state.composer) return true;
    if (!isComposerDirty()) {
      closeComposer(true);
      return true;
    }
    if (!state.composer.discardArmed) {
      armDiscard();
      return false;
    }
    closeComposer(true);
    return true;
  }

  function closeComposer(silent = true) {
    void silent;
    if (!state.composer) {
      if (ui) ui.composer.hidden = true;
      return;
    }
    clearTimeout(state.composer.discardTimer);
    state.composer = null;
    if (!ui) return;
    ui.composer.hidden = true;
    ui.composer.classList.remove("is-invalid");
    ui.composerTextarea.value = "";
    ui.composerQuote.textContent = "";
    ui.composerCancel.textContent = "取消";
    ui.composerCancel.classList.remove("is-danger");
  }

  function cancelComposer(force) {
    if (force) closeComposer(true);
    else requestCloseComposer();
  }

  function openNoteFromSelection() {
    if (!ensureReady()) return false;
    if (state.composer) {
      showToast("请先完成当前的临时笔记");
      return false;
    }
    const selection = state.selection || readSelection();
    if (!selection) {
      showToast("先选中一段文字，再添加笔记");
      return false;
    }
    hideToolbar();
    openPanel();
    startComposer({
      mode: "new",
      anchor: selection.anchor,
      quote: selection.text,
      color: state.lastColor,
      range: selection.range,
    });
    clearNativeSelection();
    return true;
  }

  function startEditNote(id) {
    if (!state.composer || state.composer.editingId !== id) {
      if (state.composer) {
        showToast("请先完成当前的临时笔记");
        return;
      }
    }
    const annotation = state.annotations.find((item) => item.id === id);
    if (!annotation || annotation.kind !== "note") return;
    openPanel();
    startComposer({
      mode: "edit",
      annotation,
      anchor: annotation.anchor,
      quote: annotation.anchor.quote,
      color: annotation.color,
      range: state.ranges.get(id) || null,
    });
  }

  function saveComposer() {
    if (!state.composer) return;
    if (!ensureReady()) return;
    const text = ui.composerTextarea.value.trim();
    if (!text) {
      ui.composer.classList.add("is-invalid");
      ui.composerTextarea.focus({ preventScroll: true });
      showToast("写点什么再保存");
      return;
    }

    const composer = state.composer;
    const color = composer.color;
    const now = Date.now();

    if (composer.mode === "edit") {
      const annotation = state.annotations.find((item) => item.id === composer.editingId);
      if (!annotation) {
        closeComposer(true);
        showToast("这条笔记已不存在");
        return;
      }
      annotation.note = text;
      annotation.color = color;
      annotation.updatedAt = now;
      const id = annotation.id;
      closeComposer(true);
      state.activeAnnotationId = id;
      persistAnnotations();
      renderHighlights();
      renderPanel();
      updateEdgeTab();
      showToast("笔记已更新", { tone: S.COLORS[color].swatch });
      return;
    }

    const annotation = {
      id: S.uid(),
      kind: "note",
      color,
      note: text,
      anchor: clone(composer.anchor),
      createdAt: now,
      updatedAt: now,
    };
    state.annotations.unshift(annotation);
    if (composer.range) {
      try {
        state.ranges.set(annotation.id, composer.range.cloneRange());
      } catch (_error) {
        // Anchor restoration handles it.
      }
    }
    state.activeAnnotationId = annotation.id;
    if (state.filter === "marks") state.filter = "all";
    closeComposer(true);
    persistAnnotations();
    if (!state.ranges.has(annotation.id)) {
      const resolved = resolveAnchor(annotation.anchor);
      if (resolved) state.ranges.set(annotation.id, resolved);
    }
    renderHighlights();
    renderPanel();
    updateEdgeTab();
    showToast("笔记已保存", {
      actionLabel: "撤销",
      onAction: () => {
        removeAnnotation(annotation.id, { notify: false });
        showToast("已撤销笔记");
      },
      tone: S.COLORS[color].swatch,
      duration: 4200,
    });
  }

  // ── Toast and reveal ───────────────────────────────────────────

  function showToast(message, { actionLabel = "", onAction = null, tone = "accent", duration = 4200 } = {}) {
    if (!ui) return;
    clearTimeout(state.toastTimer);
    state.toastAction = typeof onAction === "function" ? onAction : null;
    ui.toastMessage.textContent = message;
    ui.toast.hidden = false;
    ui.toastDot.style.background = tone === "danger" ? "var(--pn-danger)" : tone === "accent" ? "var(--pn-accent)" : tone;
    ui.toastDot.style.boxShadow =
      tone === "danger" ? "0 0 0 3px rgba(169, 80, 87, 0.13)" : `0 0 0 3px ${hexToRgba(tone, 0.14)}`;
    ui.toastAction.hidden = !(actionLabel && state.toastAction);
    if (actionLabel && state.toastAction) {
      ui.toastAction.textContent = actionLabel;
      ui.toastAction.hidden = false;
    }
    state.toastTimer = setTimeout(hideToast, duration);
  }

  function hexToRgba(value, alpha) {
    if (!/^#[0-9a-f]{6}$/i.test(String(value))) return "rgba(244, 200, 75, 0.14)";
    const hex = value.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function hideToast() {
    if (!ui) return;
    clearTimeout(state.toastTimer);
    state.toastTimer = null;
    state.toastAction = null;
    ui.toast.hidden = true;
    ui.toastAction.hidden = true;
  }

  function revealAnnotation(id, { closeOnMobile = true } = {}) {
    const range = state.ranges.get(id);
    if (!range) {
      showToast("原文位置已变化，这条批注暂时无法定位");
      return;
    }
    if (closeOnMobile && innerWidth <= 620) closePanel();
    let rect = null;
    try {
      rect = range.getBoundingClientRect();
    } catch (_error) {
      rect = null;
    }
    if (rect && (rect.width || rect.height)) {
      const targetTop = Math.max(0, window.scrollY + rect.top - Math.min(innerHeight * 0.34, 300));
      const behavior = isReducedMotion() ? "auto" : "smooth";
      try {
        window.scrollTo({ top: targetTop, behavior });
      } catch (_error) {
        window.scrollTo(0, targetTop);
      }
    }
    setTimeout(() => flashRange(range), isReducedMotion() ? 50 : 380);
  }

  function flashRange(range) {
    if (!ui) return;
    ui.flashLayer.replaceChildren();
    let rects = [];
    try {
      rects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight,
      );
    } catch (_error) {
      rects = [];
    }
    if (!rects.length) return;
    for (const rect of rects.slice(0, 12)) {
      const flash = document.createElement("span");
      flash.className = "pn-flash";
      flash.style.left = `${rect.left - 3}px`;
      flash.style.top = `${rect.top - 3}px`;
      flash.style.width = `${Math.max(2, rect.width + 6)}px`;
      flash.style.height = `${Math.max(2, rect.height + 6)}px`;
      ui.flashLayer.appendChild(flash);
    }
    setTimeout(() => {
      if (ui) ui.flashLayer.replaceChildren();
    }, 1450);
  }

  // ── Panel interactions ─────────────────────────────────────────

  function bindUiEvents() {
    ui.edge.addEventListener("click", () => openPanel({ focusPanel: true }));

    ui.toolbar.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    ui.toolbar.addEventListener("click", (event) => {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      event.preventDefault();
      event.stopPropagation();
      const action = actionEl.dataset.action;
      if (action === "highlight") applyHighlight(actionEl.dataset.color);
      else if (action === "underline") applyUnderline(state.lastColor);
      else if (action === "note") openNoteFromSelection();
      else if (action === "dismiss") hideToolbar();
    });

    ui.panel.addEventListener("click", (event) => {
      const actionEl = event.target.closest("[data-action]");
      if (actionEl) {
        const action = actionEl.dataset.action;
        if (action === "filter") {
          state.filter = actionEl.dataset.filter;
          state.activeAnnotationId = null;
          renderPanel();
          ui.list.scrollTop = 0;
          return;
        }
        if (action === "delete") {
          event.preventDefault();
          event.stopPropagation();
          const card = actionEl.closest(".pn-card");
          if (card) removeAnnotation(card.dataset.id);
          return;
        }
        if (action === "edit") {
          event.preventDefault();
          event.stopPropagation();
          const card = actionEl.closest(".pn-card");
          if (card) startEditNote(card.dataset.id);
          return;
        }
        if (action === "locate") {
          event.preventDefault();
          event.stopPropagation();
          const card = actionEl.closest(".pn-card");
          if (card) {
            state.activeAnnotationId = card.dataset.id;
            renderPanel();
            revealAnnotation(card.dataset.id);
          }
          return;
        }
        if (action === "clear-all") {
          event.preventDefault();
          event.stopPropagation();
          handleClearAll();
          return;
        }
        if (action === "close-panel") {
          event.preventDefault();
          event.stopPropagation();
          handlePanelClose();
          return;
        }
        if (action === "cancel-note") {
          event.preventDefault();
          event.stopPropagation();
          requestCloseComposer();
          return;
        }
        if (action === "save-note") {
          event.preventDefault();
          event.stopPropagation();
          saveComposer();
          return;
        }
        if (action === "compose-color") {
          event.preventDefault();
          event.stopPropagation();
          setComposerColor(actionEl.dataset.color);
          return;
        }
      }

      const card = event.target.closest(".pn-card");
      if (card) {
        state.activeAnnotationId = card.dataset.id;
        renderPanel();
        revealAnnotation(card.dataset.id);
      }
    });

    ui.panel.addEventListener("keydown", (event) => {
      const card = event.target.closest(".pn-card");
      if (card && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        state.activeAnnotationId = card.dataset.id;
        revealAnnotation(card.dataset.id);
      }
    });

    ui.composerTextarea.addEventListener("input", () => {
      ui.composer.classList.remove("is-invalid");
      updateComposerCounter();
      if (state.composer) resetDiscardArm();
    });

    ui.toastAction.addEventListener("click", () => {
      const action = state.toastAction;
      hideToast();
      if (action) action();
    });
    ui.toastClose.addEventListener("click", hideToast);

    ui.panel.addEventListener("mousedown", (event) => {
      // Clicks inside the panel should never dismiss or disturb the page selection UI.
      event.stopPropagation();
    });
  }

  // ── Page events ────────────────────────────────────────────────

  function bindPageEvents() {
    document.addEventListener(
      "mouseup",
      (event) => {
        if (event.button !== 0) return;
        if (eventTouchesUi(event)) return;
        if (!state.ready || state.composer) return;
        setTimeout(refreshSelectionToolbar, 20);
      },
      true,
    );

    document.addEventListener(
      "mousedown",
      (event) => {
        if (eventTouchesUi(event)) return;
        if (ui && !ui.selection.hidden) hideToolbar();
      },
      true,
    );

    document.addEventListener(
      "click",
      (event) => {
        if (eventTouchesUi(event)) return;
        if (!state.ready || state.composer) return;
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return;
        if (isEditableContext(event.target)) return;
        const found = annotationAtPoint(event.clientX, event.clientY);
        if (!found) return;
        openPanel({ focusCardId: found.id });
      },
      true,
    );

    document.addEventListener(
      "keyup",
      (event) => {
        if (eventTouchesUi(event)) return;
        if (!state.ready || state.composer) return;
        if (["Shift", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
          refreshSelectionToolbar();
        }
      },
      true,
    );

    document.addEventListener("keydown", onGlobalKeyDown, true);

    // Touch devices do not always fire a final mouseup after the selection
    // handles settle. Debounced selectionchange makes the toolbar reachable.
    if (globalThis.matchMedia && matchMedia("(pointer: coarse)").matches) {
      document.addEventListener("selectionchange", () => {
        if (!state.ready || state.composer) return;
        clearTimeout(state.selectionTimer);
        state.selectionTimer = setTimeout(() => {
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed) refreshSelectionToolbar();
        }, 340);
      });
    }

    window.addEventListener(
      "scroll",
      () => {
        if (!ui) return;
        if (!ui.selection.hidden) hideToolbar();
      },
      { capture: true, passive: true },
    );

    window.addEventListener(
      "resize",
      () => {
        if (!ui) return;
        if (!ui.selection.hidden) hideToolbar();
      },
      { passive: true },
    );

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(onStorageChanged);
    }

    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(onRuntimeMessage);
    }

    lastHref = location.href.split("#")[0];
    locationTimer = window.setInterval(() => {
      const href = location.href.split("#")[0];
      if (href !== lastHref) {
        lastHref = href;
        handleLocationChange();
      }
    }, 650);
  }

  function annotationAtPoint(x, y) {
    let best = null;
    let bestArea = Infinity;
    for (const annotation of state.annotations) {
      const range = state.ranges.get(annotation.id);
      if (!range) continue;
      let rects = [];
      try {
        rects = Array.from(range.getClientRects());
      } catch (_error) {
        continue;
      }
      for (const rect of rects) {
        if (
          x >= rect.left - 2 &&
          x <= rect.right + 2 &&
          y >= rect.top - 2 &&
          y <= rect.bottom + 2
        ) {
          const area = rect.width * rect.height;
          const bonus = annotation.kind === "note" ? -1 : 0;
          if (area + bonus < bestArea) {
            bestArea = area + bonus;
            best = annotation;
          }
        }
      }
    }
    return best;
  }

  function onGlobalKeyDown(event) {
    if (event.defaultPrevented) return;
    if (event.isComposing) return;
    const key = event.key;

    if (state.composer) {
      if (key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        requestCloseComposer();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        saveComposer();
        return;
      }
    }

    if (state.selection && !ui.selection.hidden) {
      if (key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        hideToolbar();
        clearNativeSelection();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        if (["1", "2", "3", "4"].includes(key)) {
          event.preventDefault();
          event.stopPropagation();
          applyHighlight(S.COLOR_ORDER[Number(key) - 1]);
          return;
        }
        if (key.toLowerCase() === "u") {
          event.preventDefault();
          event.stopPropagation();
          applyUnderline(state.lastColor);
          return;
        }
        if (key.toLowerCase() === "n") {
          event.preventDefault();
          event.stopPropagation();
          openNoteFromSelection();
          return;
        }
      }
    }

    if (key === "Escape" && state.sidebarOpen) {
      event.preventDefault();
      handlePanelClose();
    }
  }

  function onStorageChanged(changes, areaName) {
    if (areaName !== "local" || !state.storageKey || !state.ready) return;
    const change = changes[state.storageKey];
    if (!change) return;
    const incoming = normalizeList(change.newValue);
    if (JSON.stringify(incoming) === JSON.stringify(state.annotations)) return;
    const editingId = state.composer ? state.composer.editingId : null;
    state.annotations = incoming;
    if (editingId && !state.annotations.some((annotation) => annotation.id === editingId)) {
      closeComposer(true);
    }
    restoreRanges();
    scheduleRestoreRetries();
  }

  function onRuntimeMessage(message, sender, sendResponse) {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "PN_PING") {
      sendResponse({ ok: true, version: S.VERSION, ready: state.ready });
      return;
    }
    if (message.type === "PN_OPEN_PANEL") {
      if (message.toggle && state.sidebarOpen) closePanel();
      else openPanel({ focusPanel: true });
      sendResponse({ ok: true, open: state.sidebarOpen });
      return;
    }
    if (message.type === "PN_HIGHLIGHT_SELECTION") {
      const selection = readSelection();
      if (!selection) {
        showToast("先选中一段文字，再按快捷键");
        sendResponse({ ok: false, reason: "no-selection" });
        return;
      }
      const ok = applyHighlight("yellow", selection);
      sendResponse({ ok });
      return;
    }
    if (message.type === "PN_ADD_NOTE") {
      const selection = readSelection();
      if (!selection) {
        showToast("先选中一段文字，再添加笔记");
        sendResponse({ ok: false, reason: "no-selection" });
        return;
      }
      const ok = openNoteFromSelectionFromSnapshot(selection);
      sendResponse({ ok });
      return;
    }
    sendResponse({ ok: false, reason: "unknown-message" });
  }

  function openNoteFromSelectionFromSnapshot(selection) {
    if (!selection) return false;
    if (state.composer) {
      showToast("请先完成当前的临时笔记");
      return false;
    }
    hideToolbar();
    openPanel();
    startComposer({
      mode: "new",
      anchor: selection.anchor,
      quote: selection.text,
      color: state.lastColor,
      range: selection.range,
    });
    clearNativeSelection();
    return true;
  }

  async function handleLocationChange() {
    if (!state.ready && !state.storageKey) return;
    hideToolbar();
    hideToast();
    closeComposer(true);
    await loadPage();
  }

  function handleFullscreenChange() {
    if (!host) return;
    const fsElement = document.fullscreenElement;
    const canHostInside =
      fsElement &&
      fsElement !== document.documentElement &&
      !["VIDEO", "IFRAME", "OBJECT", "EMBED"].includes(fsElement.tagName);
    const parent = canHostInside ? fsElement : document.documentElement;
    if (host.parentNode !== parent) {
      try {
        parent.appendChild(host);
      } catch (_error) {
        document.documentElement.appendChild(host);
      }
    }
    hideToolbar();
  }

  // ── Boot ───────────────────────────────────────────────────────

  async function boot() {
    if (!document.documentElement || !document.body) {
      window.addEventListener("DOMContentLoaded", boot, { once: true });
      return;
    }
    if (!buildUI()) return;
    await loadPage();
  }

  boot().catch((error) => {
    // Never break the host page because of page-note init.
    console.warn("[页注] failed to initialize", error);
  });
})();
