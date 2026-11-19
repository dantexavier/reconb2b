// The calculator is shown per tab: clicking the toolbar icon (or Alt+Shift+A)
// opens it only on that tab. It stays open on that tab across page loads, so
// you can click through auction listings without reopening it.
// The set of open tab IDs lives in session storage (cleared when Chrome closes).
//
// Sites: it runs automatically on the auction sites listed in manifest.json.
// On any other site, the first click asks Chrome's "Allow on this site?" and,
// if allowed, registers the calculator for that site from then on.

const BUILT_IN = /^https:\/\/([a-z0-9-]+\.)*(manheim|adesa|openlane|acvauctions)\.com\//i;

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
    // No calculator on this page yet; it reads its state when injected.
  });
}

const originOf = (url) => {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.origin : null;
  } catch {
    return null;
  }
};
const scriptId = (origin) => 'site:' + origin;

// Make the calculator load on this site on every future page load too.
async function registerSite(origin) {
  const id = scriptId(origin);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length) return;
  await chrome.scripting.registerContentScripts([
    { id, matches: [origin + '/*'], js: ['content.js'], runAt: 'document_idle', persistAcrossSessions: true },
  ]);
}

function toggle(tab) {
  if (!tab?.id) return;
  const origin = originOf(tab.url);
  if (!origin) return; // chrome:// pages, the Web Store, etc.

  // Ask for the site right away, while Chrome still counts this as your click.
  // (Already-allowed sites resolve instantly with no prompt.)
  const allowed = BUILT_IN.test(tab.url)
    ? Promise.resolve(true)
    : chrome.permissions.request({ origins: [origin + '/*'] }).catch(() => false);

  (async () => {
    const open = await getOpenTabs();
    if (open.has(tab.id)) return setTabVisible(tab.id, false);

    if (!(await allowed)) return; // "Allow on this site?" was declined
    if (!BUILT_IN.test(tab.url)) await registerSite(origin);
    await setTabVisible(tab.id, true);
    // Load it into the page that's already open (no-op if it's already there).
    await chrome.scripting
      .executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
      .catch(() => {});
  })();
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

// If you remove a site in chrome://extensions → Site access, stop loading there.
chrome.permissions.onRemoved.addListener(async ({ origins = [] }) => {
  const ids = origins.map((o) => scriptId(o.replace(/\/\*$/, '')));
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids });
  if (registered.length) {
    await chrome.scripting.unregisterContentScripts({ ids: registered.map((s) => s.id) });
  }
});
