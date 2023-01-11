chrome.action.onClicked.addListener((tab) => {
  if (tab.url === undefined) return;
  if (tab.url.indexOf(':') > 5) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['highlight.js'],
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab.id;
  chrome.action.setBadgeText({text: message.toString(), tabId});
  setTimeout(() => chrome.action.setBadgeText({text: '', tabId}), 5000);
});
