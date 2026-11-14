/**
 * 页注 · PageNote — action popup.
 */
(() => {
  "use strict";

  const S = globalThis.PageNoteShared;
  if (!S) return;

  const CONTENT_FILES = ["shared/constants.js", "content/styles.js", "content/content.js"];
  const IS_MAC = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || "");

  const els = {
    pageTitle: document.getElementById("pageTitle"),
    pageHost: document.getElementById("pageHost"),
    pageStatus: document.getElementById("pageStatus"),
    markCount: document.getElementById("markCount"),
    noteCount: document.getElementById("noteCount"),
    stats: document.getElementById("stats"),
    notice: document.getElementById("notice"),
    noticeTitle: document.getElementById("noticeTitle"),
    noticeText: document.getElementById("noticeText"),
    openPanel: document.getElementById("openPanel"),
    ctaLabel: document.getElementById("ctaLabel"),
    shortcut: document.getElementById("shortcut"),
    inlineError: document.getElementById("inlineError"),
  };

  const state = {
    tab: null,
    url: "",
    blocked: false,
    busy: false,
  };

  function tabsQuery(queryInfo) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query(queryInfo, (tabs) => {
          const error = chrome.runtime.lastError;
          if (error) reject(new Error(error.message));
          else resolve(Array.isArray(tabs) ? tabs : []);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function storageGet(key) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(key, (result) => {
          const error = chrome.runtime.lastError;
          if (error) reject(new Error(error.message));
          else resolve(result || {});
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function sendToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          const error = chrome.runtime.lastError;
          if (error) reject(new Error(error.message));
          else resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function hostForUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "file:") return "本地文件";
      return parsed.hostname.replace(/^www\./i, "") || parsed.hostname;
    } catch (_error) {
      return "";
    }
  }

  function setStatus(text, blocked = false) {
    els.pageStatus.textContent = text;
    els.pageStatus.classList.toggle("is-blocked", blocked);
  }

  function showNotice(title, text) {
    state.blocked = true;
    document.body.classList.add("is-blocked");
    els.notice.hidden = false;
    els.noticeTitle.textContent = title;
    els.noticeText.textContent = text;
    els.openPanel.disabled = true;
    els.ctaLabel.textContent = "当前页面暂不支持";
    setStatus("不可用", true);
  }

  function setBusy(busy) {
    state.busy = busy;
    els.openPanel.disabled = busy || state.blocked;
    els.openPanel.classList.toggle("is-busy", busy);
    if (busy) {
      els.ctaLabel.textContent = "正在打开批注栏…";
      hideError();
    }
  }

  function showError(message) {
    els.inlineError.hidden = false;
    els.inlineError.textContent = message;
  }

  function hideError() {
    els.inlineError.hidden = true;
    els.inlineError.textContent = "";
  }

  function setCtaLabel(total) {
    els.ctaLabel.textContent = total > 0 ? `查看 ${total} 条批注` : "打开本页批注";
    els.openPanel.setAttribute(
      "aria-label",
      total > 0 ? `打开本页批注栏，共 ${total} 条批注` : "打开本页批注栏",
    );
  }

  async function readCounts(url) {
    const key = S.pageStorageKey(url);
    try {
      const stored = await storageGet(key);
      const list = Array.isArray(stored[key]) ? stored[key] : [];
      const notes = list.filter((annotation) => annotation && annotation.kind === "note").length;
      const marks = list.filter((annotation) => annotation && annotation.kind !== "note").length;
      return { total: list.length, marks, notes };
    } catch (_error) {
      return { total: 0, marks: 0, notes: 0, failed: true };
    }
  }

  async function ensureContentScript(tabId) {
    try {
      const pong = await sendToTab(tabId, { type: "PN_PING" });
      if (pong && pong.ok) return;
    } catch (_error) {
      // Inject below.
    }
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
    await sleep(120);
    await sendToTab(tabId, { type: "PN_PING" });
  }

  async function openPanel() {
    if (state.busy || state.blocked || !state.tab || !state.tab.id) return;
    setBusy(true);
    try {
      await ensureContentScript(state.tab.id);
      await sendToTab(state.tab.id, { type: "PN_OPEN_PANEL" });
      window.close();
    } catch (_error) {
      setBusy(false);
      setCtaLabel(Number(els.markCount.textContent) + Number(els.noteCount.textContent));
      showError("无法在当前页面打开批注栏。请刷新页面后重试；浏览器内部页面和 PDF 阅读器不支持扩展运行。");
    }
  }

  function renderShortcutKeys(shortcut) {
    if (!shortcut) {
      els.shortcut.hidden = true;
      return;
    }
    const labels = shortcut
      .split("+")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        if (!IS_MAC) return part;
        return (
          {
            Alt: "⌥",
            Option: "⌥",
            Shift: "⇧",
            Ctrl: "⌃",
            Control: "⌃",
            Command: "⌘",
            MacCtrl: "⌃",
          }[part] || part
        );
      });

    els.shortcut.replaceChildren();
    els.shortcut.append(document.createTextNode("快捷键 "));
    const caps = document.createElement("span");
    caps.className = "keycaps";
    caps.setAttribute("aria-label", labels.join(" "));
    for (const label of labels) {
      const kbd = document.createElement("kbd");
      kbd.textContent = label;
      caps.append(kbd);
    }
    els.shortcut.append(caps, document.createTextNode(" 随手打开"));
  }

  async function renderShortcut() {
    try {
      if (!chrome.commands || !chrome.commands.getAll) {
        renderShortcutKeys("Alt+Shift+N");
        return;
      }
      const commands = await chrome.commands.getAll();
      const command = (commands || []).find((item) => item.name === "toggle-panel");
      renderShortcutKeys((command && command.shortcut) || "");
    } catch (_error) {
      renderShortcutKeys("");
    }
  }

  async function init() {
    els.openPanel.addEventListener("click", openPanel);
    renderShortcut();

    let tab = null;
    try {
      const tabs = await tabsQuery({ active: true, currentWindow: true });
      tab = tabs[0] || null;
    } catch (_error) {
      tab = null;
    }

    if (!tab) {
      els.pageTitle.textContent = "无法读取当前页面";
      els.pageHost.textContent = "";
      showNotice("无法读取当前页面", "关闭弹窗后重试，或先打开一个普通网页。");
      return;
    }

    state.tab = tab;
    state.url = tab.url || tab.pendingUrl || "";
    els.pageTitle.textContent = tab.title || "未命名页面";
    els.pageHost.textContent = hostForUrl(state.url);
    els.pageHost.title = state.url;

    if (!state.url) {
      showNotice("无法读取页面地址", "请刷新页面，或换一个普通网页后再试。");
      return;
    }

    if (S.isPdfUrl(state.url)) {
      showNotice(
        "PDF 页面暂不支持",
        "Chrome 内置 PDF 阅读器不允许扩展读取文字。页注目前主要支持普通网页；PDF 文本层批注已在计划中。",
      );
      return;
    }

    if (!S.isSupportedPageUrl(state.url)) {
      showNotice(
        "这个页面无法批注",
        "浏览器内部页面、扩展商店和本地设置页面不允许扩展运行。打开一个普通网页后再试。",
      );
      return;
    }

    setStatus("已就绪");
    setCtaLabel(0);

    const counts = await readCounts(state.url);
    els.markCount.textContent = String(counts.marks);
    els.noteCount.textContent = String(counts.notes);
    setCtaLabel(counts.total);
    if (counts.failed) {
      setStatus("统计暂不可用");
      showError("暂时无法读取本页的批注数量，仍可打开批注栏。");
    }
  }

  init().catch((error) => {
    console.warn("[页注] popup init failed", error);
    els.pageTitle.textContent = "页注";
    showNotice("发生了一点问题", "请关闭弹窗后重试。");
  });
})();
