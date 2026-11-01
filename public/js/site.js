// Mobile menu + photo lightbox. No dependencies.
(function () {
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
    });
  }

  var lb = document.getElementById('lightbox');
  if (!lb) return;
  var links = Array.prototype.slice.call(document.querySelectorAll('a.lb'));
  if (!links.length) return;
  var img = lb.querySelector('img');
  var cap = lb.querySelector('figcaption');
  var idx = 0, lastFocus = null;

  function show(i) {
    idx = (i + links.length) % links.length;
    var a = links[idx];
    img.src = a.getAttribute('href');
    img.alt = a.getAttribute('data-caption') || '';
    cap.textContent = a.getAttribute('data-caption') || '';
    // preload neighbors
    [idx + 1, idx - 1].forEach(function (n) { var k = (n + links.length) % links.length; var p = new Image(); p.src = links[k].getAttribute('href'); });
  }
  function open(i) { lastFocus = document.activeElement; show(i); lb.hidden = false; document.body.style.overflow = 'hidden'; lb.querySelector('.lightbox-close').focus(); }
  function close() { lb.hidden = true; document.body.style.overflow = ''; img.src = ''; if (lastFocus) lastFocus.focus(); }

  links.forEach(function (a, i) { a.addEventListener('click', function (e) { e.preventDefault(); open(i); }); });
  lb.querySelector('.lightbox-close').addEventListener('click', close);
  lb.querySelector('.lightbox-prev').addEventListener('click', function () { show(idx - 1); });
  lb.querySelector('.lightbox-next').addEventListener('click', function () { show(idx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'ArrowLeft') show(idx - 1);
  });
  // swipe
  var sx = null;
  lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) show(dx < 0 ? idx + 1 : idx - 1);
  });
})();
