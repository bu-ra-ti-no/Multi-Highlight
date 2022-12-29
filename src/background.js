chrome.action.onClicked.addListener((tab) => {
  if (tab.url.indexOf(':') > 5) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['highlight.js'],
  });
});

