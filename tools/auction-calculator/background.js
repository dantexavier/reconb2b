// The calculator is shown per tab: clicking the toolbar icon (or Alt+Shift+A)
// opens it only on that tab. It stays open on that tab across page loads, so
// you can click through auction listings without reopening it.
// The set of open tab IDs lives in session storage (cleared when Chrome closes).

async function getOpenTabs() {
  const { openTabs = [] } = await chrome.storage.session.get('openTabs');
  return new Set(openTabs);
}

async function setTabVisible(tabId, visible) {
  const open = await getOpenTabs();
  if (visible) open.add(tabId);
  else open.delete(tabId);
  await chrome.storage.session.set({ openTabs: [...open] });
  chrome.tabs.sendMessage(tabId, { type: 'setVisible', visible }).catch(() => {
    // No content script on this page (e.g. chrome:// pages or the Web Store).
  });
}

async function toggle(tab) {
  if (!tab?.id) return;
  const open = await getOpenTabs();
  await setTabVisible(tab.id, !open.has(tab.id));
}

chrome.action.onClicked.addListener(toggle);
chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === 'toggle-calculator') toggle(tab);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (tabId == null) return;
  if (msg.type === 'getVisible') {
    getOpenTabs().then((open) => sendResponse({ visible: open.has(tabId) }));
    return true; // async response
  }
  if (msg.type === 'hide') setTabVisible(tabId, false);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const open = await getOpenTabs();
  if (open.delete(tabId)) await chrome.storage.session.set({ openTabs: [...open] });
});
