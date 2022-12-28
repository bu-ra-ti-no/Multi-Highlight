chrome.action.onClicked.addListener((tab) => {
  if (tab.url.split(':')[0].length > 5) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['highlight.js'],
  });
});

