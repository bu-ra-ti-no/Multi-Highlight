// i18n
document.body.innerHTML = document.body.innerHTML.replace(
  /__MSG_(\w+)__/g, (_, v) => v ? chrome.i18n.getMessage(v) : '');


const state = {
  _key: '',
  get currentKey() {
    return this._key;
  },
  set currentKey(value) {
    if (value && this._key !== value) {
      this._key = value;
      const index = value.slice(5);
      document.querySelectorAll('input[type="radio"]')[index - 1].checked = true;
      fillTable();
      chrome.storage.local.set(
        { currentKey: value },
        () => {}
      );
    }
  }
};
const tbody = document.querySelector('tbody');

chrome.storage.local.get('currentKey', (result1) => {
  state.currentKey = result1.currentKey;
  if (!state.currentKey) {
    // first run? old storage?
    chrome.storage.local.get('words', (result2) => {
      chrome.storage.local.remove('words');
      chrome.storage.local.set(
        { words1: result2.words || [] },
        () => state.currentKey = 'words1'
      );
    });
  }
});

chrome.storage.local.get('auto', (result) => {
  document.getElementById('auto').checked = Boolean(result.auto);
});

document.getElementById('add').onclick = () => add();

document.getElementById('auto').onclick = function() {
  chrome.storage.local.set({ auto: this.checked }, () => {});
  chrome.runtime.sendMessage(undefined, `auto:${this.checked ? 'on' : 'off'}`);
};

tbody.onclick = (e) => {
  if (e.target.tagName === 'BUTTON') {
    e.target.closest('tr').remove();
    lockKey();
  }
};

tbody.oninput = () => {
  lockKey();
};

document.getElementById('copy').onclick = function () {
  navigator.clipboard
    .writeText(JSON.stringify(toArray()))
    .catch(e => alert(e.message));
};

document.getElementById('paste').onclick = function () {
  navigator.clipboard
    .readText()
    .then(txt => fromArray(JSON.parse(txt)))
    .then(() => lockKey())
    .catch(e => alert(e.message));
};

document.getElementById('apply').onclick = function () {
  chrome.storage.local.set(
    { [state.currentKey]: toArray() },
    unlockKey
  );
};

document.getElementById('cancel').onclick = function () {
  fillTable();
  unlockKey();
};

Array.from(document.querySelectorAll('body>label:not(:last-of-type)'))
  .forEach(e => e.addEventListener('click', keySelectionHandler));

function keySelectionHandler() {
  const input = this.firstChild;
  setTimeout(() => {
    if (input.checked) {
      state.currentKey = 'words' + input.nextSibling.textContent;
    }
  }, 100)
  
}

function add(item = {
  word: '', color: '#dd0000', matchCase: false, wholeWord: false, focus: true
}) {
  const tr = document.createElement('tr');

  tr.innerHTML = `
    <td><input value="${item.word}" pattern="^\/.+\/i?$" title></td>
    <td><input type="color" value="${item.color}"></td>
    <td><input type="checkbox"${item.matchCase ? ' checked' : ''}></td>
    <td><input type="checkbox"${item.wholeWord ? ' checked' : ''}></td>
    <td><button>&#x2716;</button></td>`;

  tbody.appendChild(tr);

  if (item.focus) tr.querySelector('input').focus();
}

function toArray() {
  return Array.from(tbody.rows)
    .map((tr) => {
      const inputs = tr.querySelectorAll('input');
      const re = !inputs[0].validity.patternMismatch;
      return {
        re,
        word: inputs[0].value,
        color: inputs[1].value,
        matchCase: re ? undefined : inputs[2].checked,
        wholeWord: re ? undefined : inputs[3].checked,
      };
    })
    .filter(item => item.word);
}

function fromArray(arr) {
  if (!Array.isArray(arr)) throw new Error('Invalid format');
  tbody.replaceChildren();
  arr.forEach(add);
}

function fillTable() {
  chrome.storage.local.get(state.currentKey, (result) => {
    fromArray(result[state.currentKey] || []);
  });
}

function lockKey() {
  document.getElementById('apply').removeAttribute('disabled');
  document.getElementById('cancel').removeAttribute('disabled');
  Array.from(document.querySelectorAll('input[type="radio"]:not(:checked)'))
    .forEach(input => input.parentElement.style.visibility = 'hidden');
}

function unlockKey() {
  document.getElementById('apply').setAttribute('disabled', '');
  document.getElementById('cancel').setAttribute('disabled', '');
  Array.from(document.querySelectorAll('input[type="radio"]'))
    .forEach(input => input.parentElement.style.visibility = null);
}
