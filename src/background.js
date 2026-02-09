/**
 * @typedef SearchItem - one row from table
 * @property {string | RegExp} word
 * @property {string} color
 * @property {boolean} wholeWord
 * @property {boolean} matchCase
 * @property {boolean} re - the word is Regexp
 * @property {Range[][]} frames - ranges grouped by frames
 */

chrome.action.onClicked.addListener(highlight);

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message === 'auto:on') {
    return auto(true);
  } else if (message === 'auto:off') {
    return auto(false);
  }
});

chrome.storage.local.get('auto', result => auto(result.auto === true));

function auto(value) {
  if (value) {
    if (!chrome.tabs.onUpdated.hasListener(updatedListener)) {
      chrome.tabs.onUpdated.addListener(updatedListener);
    }
  } else {
    if (chrome.tabs.onUpdated.hasListener(updatedListener)) {
      chrome.tabs.onUpdated.removeListener(updatedListener);
    }
  }
}

function updatedListener(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url) {
    const url = new URL(tab.url);
    if (url.protocol !== 'chrome:') {
      highlight(tab);
    }
  }
}

async function highlight(tab) {
  if (tab.url === undefined) return;
  if (tab.url.indexOf(':') > 5) return;

  try {
    const tabId = tab.id;
    const results = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      files: ['highlight.js'],
    });

    const count = results.reduce((a, result) => a + (result.result || 0), 0);

    chrome.action.setBadgeText({text: count.toString(), tabId});
    setTimeout(() => {
      chrome.action.setBadgeText({text: '', tabId}).catch(() => {});
    }, 5000);
  } catch (error) {
    console.error('Multi-Highlight: ' + (error.message || error));
  }
}
