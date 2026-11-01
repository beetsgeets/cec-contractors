// Admin: photo previews before upload, uploading overlay, drag-to-reorder
// (touch friendly), captions, cover, delete. No dependencies.
(function () {
  function post(url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.CSRF }, body: JSON.stringify(data || {}) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function toast(msg, bad) {
    var t = document.createElement('div'); t.className = 'edit-toast' + (bad ? ' is-bad' : ''); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  // ---- previews + uploading overlay ----------------------------------------------
  var input = document.getElementById('photos');
  var preview = document.getElementById('preview');
  if (input && preview) {
    input.addEventListener('change', function () {
      preview.innerHTML = '';
      var files = Array.prototype.slice.call(input.files || []);
      files.slice(0, 40).forEach(function (f) {
        if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) return;
        var d = document.createElement('div'); d.className = 'preview-item';
        if (/^image\/(jpeg|png|webp|gif)$/.test(f.type)) {
          var im = document.createElement('img'); im.src = URL.createObjectURL(f); im.onload = function () { URL.revokeObjectURL(im.src); }; d.appendChild(im);
        } else { d.textContent = f.name; }
        preview.appendChild(d);
      });
      var n = files.length;
      if (n) { var c = document.createElement('p'); c.className = 'muted'; c.textContent = n + ' photo' + (n === 1 ? '' : 's') + ' selected'; preview.appendChild(c); }
    });
  }
  var form = document.getElementById('jobform');
  if (form) {
    form.addEventListener('submit', function () {
      var btn = document.getElementById('submit');
      if (btn) { btn.disabled = true; btn.textContent = 'Working…'; }
      if (input && input.files && input.files.length) document.getElementById('uploading').hidden = false;
    });
  }

  // ---- generic drag-to-reorder for a list --------------------------------------------
  function sortable(list, handleSel, onDone) {
    var dragging = null, placeholder = null, pointerId = null, items;
    function itemsOf() { return Array.prototype.slice.call(list.children); }
    list.addEventListener('pointerdown', function (e) {
      var h = e.target.closest(handleSel); if (!h) return;
      var li = h.closest('li'); if (!li) return;
      e.preventDefault();
      dragging = li; pointerId = e.pointerId; items = itemsOf();
      li.classList.add('is-dragging');
      li.setPointerCapture && li.setPointerCapture(pointerId);
      document.body.style.userSelect = 'none';
    });
    list.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var over = el && el.closest('li'); if (!over || over === dragging || over.parentNode !== list) return;
      var r = over.getBoundingClientRect();
      var horizontal = list.classList.contains('photogrid');
      var before = horizontal ? (e.clientX < r.left + r.width / 2) : (e.clientY < r.top + r.height / 2);
      if (before) list.insertBefore(dragging, over); else list.insertBefore(dragging, over.nextSibling);
    });
    function end() {
      if (!dragging) return;
      dragging.classList.remove('is-dragging'); dragging = null; document.body.style.userSelect = '';
      onDone(itemsOf().map(function (li) { return Number(li.dataset.id); }));
    }
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
  }

  var joblist = document.getElementById('joblist');
  if (joblist) sortable(joblist, '.drag', function (ids) {
    post('/admin/jobs/reorder', { ids: ids }).then(function () { toast('Order saved.'); }).catch(function () { toast('Couldn’t save the order.', true); });
  });

  var grid = document.getElementById('photogrid');
  if (grid) {
    sortable(grid, '.photo-drag', function (ids) {
      post('/admin/photos/reorder', { ids: ids }).then(function () { toast('Photo order saved.'); }).catch(function () { toast('Couldn’t save the order.', true); });
    });
    grid.addEventListener('change', function (e) {
      var cap = e.target.closest('.photo-caption'); if (!cap) return;
      var id = cap.closest('li').dataset.id;
      post('/admin/photos/' + id + '/caption', { caption: cap.value }).then(function () { toast('Caption saved.'); }).catch(function () { toast('Couldn’t save the caption.', true); });
    });
    grid.addEventListener('click', function (e) {
      var li = e.target.closest('li'); if (!li) return;
      var id = li.dataset.id;
      if (e.target.closest('.act-cover')) {
        post('/admin/photos/' + id + '/cover').then(function () {
          grid.querySelectorAll('li').forEach(function (x) { x.classList.remove('is-cover'); x.querySelector('.act-cover').textContent = '★ Make cover'; });
          li.classList.add('is-cover'); li.querySelector('.act-cover').textContent = '★ Cover';
          toast('Cover photo set.');
        }).catch(function () { toast('Couldn’t set the cover.', true); });
      } else if (e.target.closest('.act-delete')) {
        if (!confirm('Delete this photo from the website?')) return;
        post('/admin/photos/' + id + '/delete').then(function () { li.remove(); toast('Photo deleted.'); }).catch(function () { toast('Couldn’t delete the photo.', true); });
      }
    });
  }
})();
