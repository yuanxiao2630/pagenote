/**
 * 页注 · PageNote — MV3 service worker.
 * Owns context menu, keyboard commands, and on-demand content-script injection.
 */
"use strict";

const CONTENT_FILES = ["shared/constants.js", "content/styles.js", "content/content.js"];
const MENU_OPEN_PANEL = "pagenote-open-panel";

const COMMANDS = {
  "toggle-panel": { type: "PN_OPEN_PANEL", toggle: true },
  "highlight-selection": { type: "PN_HIGHLIGHT_SELECTION" },
  "add-note": { type: "PN_ADD_NOTE" },
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: MENU_OPEN_PANEL,
        title: "打开页注批注栏",
        contexts: ["page", "selection"],
      },
      () => void chrome.runtime.lastError,
    );
  });
});

async function sendToTab(tabId, message) {
  if (!tabId) return false;
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch (_error) {
    // Tabs that were open before installation do not have the content script yet.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: CONTENT_FILES,
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch (_error) {
    return false;
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab && tab.id ? tab : null;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_OPEN_PANEL || !tab || !tab.id) return;
  await sendToTab(tab.id, { type: "PN_OPEN_PANEL" });
});

chrome.commands.onCommand.addListener(async (command) => {
  const action = COMMANDS[command];
  if (!action) return;
  const tab = await activeTab();
  if (!tab) return;
  await sendToTab(tab.id, action);
});
