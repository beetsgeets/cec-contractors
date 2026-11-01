// Click-to-edit for site text. Loaded only when an owner is signed in and
// has turned on editing. Every editable element has data-k (its key) and
// data-ml (1 = multi-paragraph). Changes are collected and saved together.
(function () {
  var changed = {};
  var saveBtn = document.getElementById('edit-save');
  var eds = Array.prototype.slice.call(document.querySelectorAll('.ed'));
  if (!saveBtn || !eds.length) return;

  function valueOf(el) {
    if (el.getAttribute('data-ml') === '1') {
      // paragraphs -> text separated by blank lines
      var ps = Array.prototype.slice.call(el.querySelectorAll('p'));
      if (ps.length) return ps.map(function (p) { return p.innerText.replace(/ /g, ' ').trim(); }).filter(Boolean).join('\n\n');
      return el.innerText.replace(/ /g, ' ').trim();
    }
    return el.innerText.replace(/\s+/g, ' ').replace(/ /g, ' ').trim();
  }

  eds.forEach(function (el) {
    el.dataset.orig = valueOf(el);
    // keep single-line fields single-line
    if (el.getAttribute('data-ml') !== '1') {
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    }
    el.addEventListener('input', function () {
      var v = valueOf(el);
      if (v !== el.dataset.orig) { changed[el.dataset.k] = v; el.classList.add('is-dirty'); }
      else { delete changed[el.dataset.k]; el.classList.remove('is-dirty'); }
      saveBtn.disabled = Object.keys(changed).length === 0;
      saveBtn.textContent = Object.keys(changed).length ? 'Save changes (' + Object.keys(changed).length + ')' : 'Save changes';
    });
    // paste as plain text
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
  });

  function toast(msg) {
    var t = document.createElement('div'); t.className = 'edit-toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  saveBtn.addEventListener('click', function () {
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    fetch('/admin/content', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.CSRF },
      body: JSON.stringify({ changes: changed })
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (!r.ok) throw new Error('save failed');
      eds.forEach(function (el) { if (changed[el.dataset.k] !== undefined) { el.dataset.orig = changed[el.dataset.k]; el.classList.remove('is-dirty'); } });
      changed = {};
      saveBtn.textContent = 'Save changes';
      toast('Saved. Visitors see the new text now.');
    }).catch(function () {
      saveBtn.disabled = false; saveBtn.textContent = 'Save changes';
      toast('Couldn’t save. Check your connection and try again.');
    });
  });

  window.addEventListener('beforeunload', function (e) {
    if (Object.keys(changed).length) { e.preventDefault(); e.returnValue = ''; }
  });
})();
