// i18n
document.body.innerHTML = document.body.innerHTML.replace(
  /__MSG_(\w+)__/g, (_, v) => v ? chrome.i18n.getMessage(v) : '');


const tbody = document.querySelector('tbody');

document.getElementById('add').onclick = () => add();

tbody.onclick = (e) => {
  if (e.target.tagName === 'BUTTON') {
    e.target.parentNode.parentNode.remove();
    document.getElementById('apply').removeAttribute('disabled');
  }
};

tbody.onchange = (e) => {
  if (e.target.tagName === 'INPUT') {
    document.getElementById('apply').removeAttribute('disabled');
  }
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
    .then((ok) => {
      if (ok) document.getElementById('apply').removeAttribute('disabled');
    })
    .catch(e => alert(e.message));
};

document.getElementById('apply').onclick = function () {
  chrome.storage.local.set({ words: toArray() })
    .then(() => this.setAttribute('disabled', ''));
};

chrome.storage.local.get('words')
  .then((result) => {
    if (result.words) fromArray(result.words);
  });

function add(item) {
  const tr = document.createElement('tr');
  let td, focus;

  if (!item) {
    item = { word: '', color: '#dd0000', matchCase: false, wholeWord: false };
    focus = true;
  }

  td = document.createElement('td');
  td.innerHTML = `<input value="${item.word}" pattern="^\/.+\/i?$" title>`;
  tr.appendChild(td);

  td = document.createElement('td');
  td.innerHTML = `<input type="color" value="${item.color || '#ffff00'}">`;
  tr.appendChild(td);

  td = document.createElement('td');
  td.innerHTML = `<input type="checkbox"${item.matchCase ? ' checked' : ''}>`;
  tr.appendChild(td);

  td = document.createElement('td');
  td.innerHTML = `<input type="checkbox"${item.wholeWord ? ' checked' : ''}>`;
  tr.appendChild(td);

  td = document.createElement('td');
  td.innerHTML = `<button>&#x2716;</button>`;
  tr.appendChild(td);

  tbody.appendChild(tr);
  
  if (focus) tr.firstChild.firstChild.focus();
}

function toArray() {
  return Array.from(tbody.rows)
    .map((tr) => {
      const inputs = tr.querySelectorAll('input');
      const re = !inputs[0].validity.patternMismatch;
      return {
        word: inputs[0].value,
        re: re,
        color: inputs[1].value,
        matchCase: re ? undefined : inputs[2].checked,
        wholeWord: re ? undefined : inputs[3].checked,
      };
    })
    .filter(item => item.word);
}

function fromArray(arr) {
  if (!Array.isArray(arr)) return alert('Invalid format');
  tbody.querySelectorAll('tr').forEach(tr => tr.remove());
  arr.forEach(add);
  return true;
}
