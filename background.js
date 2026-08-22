function toggleGrid(tab) {
  if (!tab || tab.id == null) return;
  chrome.tabs.sendMessage(tab.id, { type: "GRID_TOGGLE" }).catch(async () => {
    // content script 尚未注入（旧页面未刷新）→ 现场注入再切换
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, { type: "GRID_TOGGLE" });
    } catch (_) {
      // 受限页面（chrome://、应用商店等）无法注入，静默忽略
    }
  });
}

chrome.action.onClicked.addListener(toggleGrid);

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-grid") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      toggleGrid(tabs && tabs[0]);
    });
  }
});
