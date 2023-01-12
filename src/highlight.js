chrome.storage.local.get('words', (result) => {
  const words = result.words || [];
  words.i = false;
  for (const word of words) {
    if (word.re) {
      word.word = word.word.slice(-1) === 'i'
        ? new RegExp(word.word.slice(1, -2), 'i')
        : new RegExp(word.word.slice(1, -1));
    } else if (!word.matchCase) {
      word.word = word.word.toLowerCase();
      words.i = true;
    }
  }

  const ignore = ['STYLE', 'SCRIPT', 'NOSCRIPT', 'OBJECT'];
  const ignoreNS = 'http://www.w3.org/2000/svg';
  let cnt = 0;

  const diveNode = (root) => {
    const whatToShow = NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_TEXT;
    const iterator = document.createNodeIterator(root, whatToShow, (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (ignore.includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.namespaceURI === ignoreNS) return NodeFilter.FILTER_REJECT;
        if (parent.shadowRoot) return NodeFilter.FILTER_REJECT;
      } else if (node.namespaceURI === ignoreNS) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    });

    let node;
    while (node = iterator.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        cnt += colorize(node, words);
      } else if (node.shadowRoot) {
        diveNode(node.shadowRoot);
      }
    }
  };

  diveNode(document.body);
  for (let i = 0; i < window.frames.length; i++) {
    diveNode(window.frames[i].document.body);
  }

  chrome.runtime.sendMessage(undefined, cnt);
});

function colorize(node, words, startIndex = 0) {
  const txt = node.data;
  if (!txt) return 0;
  const txtLow = words.i ? txt.toLowerCase() : undefined;

  const pos = [-1, -1];
  let cnt = 0;

  for (let i = startIndex; i < words.length; i++) {
    if (!search(txt, txtLow, words[i], pos)) continue;

    const text1 = pos[0] === 0 ? null : document.createTextNode(txt.substring(0, pos[0]));
    const text2 = pos[1] === txt.length ? null : document.createTextNode(txt.substring(pos[1]));
    
    if (text1 === null && text2 === null && node.parentElement.textContent === txt) {
      node.parentElement.style.backgroundColor = words[i].color;
    } else {
      const span = document.createElement('span');
      span.style.backgroundColor = words[i].color;
      span.textContent = txt.substring(pos[0], pos[1]);

      const parent = node.parentElement;

      if (text1) parent.insertBefore(text1, node);
      parent.insertBefore(span, node);
      if (text2) parent.insertBefore(text2, node);

      parent.removeChild(node);

      if (text1) cnt += colorize(text1, words, i + 1);
      if (text2) cnt += colorize(text2, words, i);
    }

    cnt++;
    break;
  }

  return cnt;
}

function search(txt, txtLow, word, pos) {
  if (word.re) {
    const found = word.word.exec(txt);
    if (found === null) return false;
    pos[0] = found.index;
    pos[1] = pos[0] + found[0].length;
    return true;
  } else if (word.wholeWord) {
    pos[1] = 0;
    while (true) {
      pos[0] = word.matchCase
        ? txt.indexOf(word.word, pos[1])
        : txtLow.indexOf(word.word, pos[1]);
      if (pos[0] < 0) return false;
      pos[1] = pos[0] + word.word.length;
      if ((pos[0] === 0 || isWhitespace(txt[pos[0] - 1]))
          && (pos[1] === txt.length || isWhitespace(txt[pos[1]]))) {
        return true;
      }
    }
  } else {
    pos[0] = word.matchCase
      ? txt.indexOf(word.word)
      : txtLow.indexOf(word.word);
    if (pos[0] < 0) return false;
    pos[1] = pos[0] + word.word.length;
    return true;
  }
}

function isWhitespace(c) {
  return c === ' ' || c === '\n' || c === '\r' || c === '\t'
    || c === '\f' || c === '\v' || c === '\u00a0' || c === '\u1680'
    || c === '\u2000' || c === '\u200a' || c === '\u2028'
    || c === '\u2029' || c === '\u202f' || c === '\u205f'
    || c === '\u3000' || c === '\ufeff';
}
