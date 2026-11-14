// Toolbar icon click or Alt+Shift+A flips a global "visible" flag.
// Every open tab's content script listens for that change, so the panel
// stays up as you move between auction listings.
async function toggle() {
  const { visible = false } = await chrome.storage.local.get('visible');
  await chrome.storage.local.set({ visible: !visible });
}

chrome.action.onClicked.addListener(toggle);
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'toggle-calculator') toggle();
});
