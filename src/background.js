chrome.action.onClicked.addListener((tab) => {
  if (tab.url === undefined) return;
  if (tab.url.indexOf(':') > 5) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['highlight.js'],
  });
});

chrome.runtime.onMessage.addListener((message) => {
  chrome.action.setBadgeText({text: message.toString()});
  setTimeout(() => chrome.action.setBadgeText({text: ''}), 5000);
});
