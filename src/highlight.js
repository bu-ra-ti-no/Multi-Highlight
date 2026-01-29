'use strict';

/**
 * @typedef SearchItem - one row from table
 * @property {string | RegExp} word
 * @property {string} color
 * @property {boolean} wholeWord
 * @property {boolean} matchCase
 * @property {boolean} re - the word is Regexp
 * @property {Range[]} ranges
 */

highlight();

function highlight() {
  return new Promise((resolve) => {
    chrome.storage.local.get('currentKey', (result) => {
      const key = result.currentKey;
      if (!key) return resolve(0);

      chrome.storage.local.get(key, (result) => {
        /** @type {SearchItem[]} */
        const searchItems = result[key] || [];
        let hasCaseInsensitive = false;
        for (const item of searchItems) {
          if (item.re) {
            item.word = item.word.endsWith('i')
              ? new RegExp(item.word.slice(1, -2), 'ig')
              : new RegExp(item.word.slice(1, -1), 'g');
          } else if (!item.matchCase) {
            item.word = item.word.toLowerCase();
            hasCaseInsensitive = true;
          }
          item.ranges = [];
        }

        // StyleSheet
        const prefix = 'mh-item-';

        Array.from(CSS.highlights.keys())
          .filter(name => name.startsWith(prefix))
          .forEach(name => CSS.highlights.delete(name));

        const cssCode = searchItems.map((item, index) => {
          const { color } = item;
          return `::highlight(${prefix}${index}) {background-color: ${color};}`;
        }).join('\n');

        let sheet = Array.from(document.adoptedStyleSheets).find(s => s.MH);
        if (sheet === undefined) {
          sheet = new CSSStyleSheet();
          sheet.MH = true;
          document.adoptedStyleSheets.push(sheet);
        }
        sheet.replaceSync(cssCode);

        // Search
        const ignore = ['STYLE', 'SCRIPT', 'NOSCRIPT', 'OBJECT', 'FRAME', 'IFRAME', 'OPTION', 'OPTGROUP'];

        const inspectNode = (root) => {
          if (!root) return;
          const whatToShow = NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_TEXT;
          const treeWalker = document.createTreeWalker(root, whatToShow, (node) => {
            if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
            if (ignore.includes(node.tagName)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          });

          while (true) {
            const node = treeWalker.nextNode();
            if (!node) break;
            if (node.nodeType === Node.TEXT_NODE) {
              colorize(node, searchItems, hasCaseInsensitive);
            } else if (node.shadowRoot) {
              inspectNode(node.shadowRoot);
            }
          }
        };

        inspectNode(document.body);

        // Highlight!
        let count = 0;
        searchItems.forEach((searchItem, index) => {
          const { ranges } = searchItem;
          if (ranges.length > 0) {
            const name = `${prefix}${index}`;
            CSS.highlights.set(name, new Highlight(...ranges));
            count += ranges.length;
          }
        });

        resolve(count);
      });
    })
  });
}

/**
 * @param {Text} node
 * @param {SearchItem[]} searchItems
 * @param {boolean} hasCaseInsensitive
 * @param {number} frameIndex
 */
function colorize(node, searchItems, hasCaseInsensitive) {
  const txt = node.data;
  if (!txt) return;
  const txtLow = hasCaseInsensitive ? txt.toLowerCase() : undefined;

  for (const searchItem of searchItems) {
    const found = search(txt, txtLow, searchItem);
    if (found === null) continue;
    const ranges = found.map((f) => {
      const range = new Range();
      range.setStart(node, f[0]);
      range.setEnd(node, f[1]);
      return range;
    });
    searchItem.ranges.push(...ranges);
  }
}

/**
 * @param {string} txt
 * @param {string} txtLow
 * @param {SearchItem} searchItem
 * @returns {number[][] | null}
 */
function search(txt, txtLow, searchItem) {
  if (searchItem.re) {
    /** @type {RegExp} */
    const regexp = searchItem.word;
    const found = txt.matchAll(regexp);
    if (found === null) return null;
    return found.map(f => [f.index, f.index + f[0].length]);
  } else if (searchItem.wholeWord) {
    let position;
    let result = null;
    while (true) {
      const pos0 = searchItem.matchCase
        ? txt.indexOf(searchItem.word, position)
        : txtLow.indexOf(searchItem.word, position);
      if (pos0 < 0) break;
      position = pos0 + searchItem.word.length;
      if ((pos0 === 0 || isWhitespace(txt[pos0 - 1]))
          && (position === txt.length || isWhitespace(txt[position]))) {
        if (result === null) result = [];
        result.push([pos0, position]);
      }
    }
    return result;
  } else {
    let position;
    let result = null;
    while (true) {
      const pos0 = searchItem.matchCase
        ? txt.indexOf(searchItem.word, position)
        : txtLow.indexOf(searchItem.word, position);
      if (pos0 < 0) break;
      position = pos0 + searchItem.word.length;
      if (result === null) result = [];
      result.push([pos0, position]);
    }
    return result;
  }
}

function isWhitespace(c) {
  return c === ' ' || c === '\n' || c === '\r' || c === '\t'
    || c === '\f' || c === '\v' || c === '\u00a0' || c === '\u1680'
    || c === '\u2000' || c === '\u200a' || c === '\u2028'
    || c === '\u2029' || c === '\u202f' || c === '\u205f'
    || c === '\u3000' || c === '\ufeff';
}
