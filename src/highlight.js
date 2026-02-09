'use strict';

/**
 * @typedef SearchItem - one row from table
 * @property {string | RegExp} word
 * @property {string} color
 * @property {boolean} wholeWord
 * @property {boolean} matchCase
 * @property {boolean} re - the word is Regexp
 * @property {Range[]} ranges
 * @property {[[number, number]]?} scrollMarks
 */

highlight();

function highlight() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['currentKey', 'scrollMarks'], (result) => {
      const key = result.currentKey;
      if (!key) return resolve(0);

      const withScrollMarks = Boolean(result.scrollMarks);

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
          item.scrollMarks = withScrollMarks ? [] : null;
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
            if (node.parentNode?.shadowRoot) return NodeFilter.FILTER_REJECT;
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

        inspectNode(document.documentElement);

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

        // Scroll-marks
        if (self === top) { // not in iframe?
          createScrollMarks(withScrollMarks ? searchItems : null);
        }

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

/** @param {SearchItem[]?} searchItems */
function createScrollMarks(searchItems) {
  const id = 'mh-scroll-marks';
  /** @type {HTMLCanvasElement} */
  let canvas = document.getElementById(id);

  if (searchItems === null) {
    return canvas?.remove();
  }

  if (canvas === null) {
    canvas = document.createElement('canvas');
    canvas.setAttribute('id', id);
    const { style } = canvas;
    style.position = 'fixed';
    style.top = '0';
    style.right = '0';
    style.outline = '1px solid whitesmoke';
    style.zIndex = '9999';
    style.width = '15px';
    style.height = '100%';
    style.pointerEvents = 'none';
    canvas.width = 15;
    canvas.height = document.documentElement.clientHeight;
    document.body.appendChild(canvas);
  }
  if (canvas.height < 100) return;

  const draw = () => {
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,
    );
    const scrollTop = document.documentElement.scrollTop;

    for (const searchItem of searchItems) {
      if (searchItem.scrollMarks.length < searchItem.ranges.length) {
        searchItem.scrollMarks = new Array(searchItem.ranges.length);
      }
      for (let i = 0; i < searchItem.ranges.length; i++) {
        const range = searchItem.ranges[i];
        const rect = range.getBoundingClientRect();
        const relativeTop = (rect.top + scrollTop) / documentHeight;
        const relativeBottom = (rect.bottom + scrollTop) / documentHeight;
        searchItem.scrollMarks[i] = [relativeTop, relativeBottom];
      }
    }

    canvas.height = document.documentElement.clientHeight;
    const ctx = canvas.getContext('2d');
    const {width, height} = canvas;
    const clientHeight = height - 2 * width;
    ctx.fillStyle = 'rgba(255, 255, 255, .5)';
    ctx.clearRect(0, 0, width, height);
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'darkgray';
    ctx.rect(1.5, 1.5, width - 3, width - 3);
    ctx.rect(1.5, height - width + 1.5, width - 3, width - 3);
    ctx.moveTo(1.5, 1.5); ctx.lineTo(width - 1.5, width - 1.5);
    ctx.moveTo(width - 1.5, 1.5); ctx.lineTo(1, width - 1.5);
    ctx.moveTo(1.5, height - width + 1.5); ctx.lineTo(width - 1.5, height - 1.5);
    ctx.moveTo(width - 1.5, height - width + 1.5); ctx.lineTo(1.5, height - 1.5);
    ctx.stroke();

    for (const searchItem of searchItems) {
      if (searchItem.ranges.length === 0) continue;
      ctx.fillStyle = searchItem.color;
      for (let i = 0; i < searchItem.ranges.length; i++) {
        const [top, bottom] = searchItem.scrollMarks[i];
        if (top < 0 || bottom > 1) continue;
        ctx.fillRect(0, width + clientHeight * top, width, clientHeight * (bottom - top));
      }
    }
  };

  draw();
  
  const fn = 'mh_resizeHandler';
  if (fn in window) {
    window.removeEventListener('resize', window[fn]);
  }
  window[fn] = draw;
  window.addEventListener('resize', draw);
}