/**
 * CEC Contractors — public site
 * Navigation and layout helpers. Wire a CMS or API to populate [data-site-content],
 * #services-mount, and #portfolio-mount when ready.
 */

(function () {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function setStatus(el, message, isError) {
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("content-status--error", !!isError);
    el.hidden = !message;
  }

  /** Build map key: page|section|content_key — same shape many headless CMS exports use. */
  function rowKey(row) {
    return row.page + "|" + row.section + "|" + row.content_key;
  }

  /** Apply CMS rows to elements with matching data-site-content. */
  function applySiteContent(rows) {
    var contentMap = {};
    (rows || []).forEach(function (row) {
      contentMap[rowKey(row)] = row.content_value;
    });

    $$("[data-site-content]").forEach(function (el) {
      var k = el.getAttribute("data-site-content");
      if (!k || !Object.prototype.hasOwnProperty.call(contentMap, k)) return;
      var val = contentMap[k];
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.value = val != null ? String(val) : "";
      } else {
        el.innerHTML = val != null ? String(val) : "";
      }
    });
  }

  function renderServices(container, rows) {
    if (!container) return;
    if (!rows || !rows.length) {
      container.innerHTML = '<p class="content-status">No services published yet.</p>';
      return;
    }
    container.innerHTML = rows
      .map(function (s) {
        var icon = safeIconClass(s.icon_class || "fas fa-wrench");
        return (
          '<article class="service-row">' +
          '<div class="service-icon"><i class="' +
          escapeAttr(icon) +
          '" aria-hidden="true"></i></div>' +
          "<div>" +
          "<h3>" +
          escapeHtml(s.title) +
          "</h3>" +
          "<p>" +
          escapeHtml(s.description || "") +
          "</p>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderPortfolio(container, rows) {
    if (!container) return;
    if (!rows || !rows.length) {
      container.innerHTML = '<p class="content-status">No portfolio items yet. Check back soon.</p>';
      return;
    }
    container.innerHTML = rows
      .map(function (p) {
        var img = p.image_url ? escapeAttr(p.image_url) : "";
        var title = escapeHtml(p.title || "Project");
        var desc = escapeHtml(p.description || "");
        var cat = p.category ? '<div class="cat">' + escapeHtml(p.category) + "</div>" : "";
        return (
          '<article class="portfolio-card">' +
          '<div class="thumb">' +
          (img
            ? '<img src="' + img + '" alt="" loading="lazy" width="600" height="450" />'
            : '<div class="content-status">No image</div>') +
          "</div>" +
          '<div class="cap">' +
          cat +
          "<h3>" +
          title +
          "</h3>" +
          "<p>" +
          desc +
          "</p>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function sortSiteContentRows(rows) {
    return rows.slice().sort(function (a, b) {
      var c =
        String(a.page || "").localeCompare(String(b.page || ""), undefined, { sensitivity: "base" });
      if (c !== 0) return c;
      c = String(a.section || "").localeCompare(String(b.section || ""), undefined, { sensitivity: "base" });
      if (c !== 0) return c;
      return String(a.content_key || "").localeCompare(String(b.content_key || ""), undefined, {
        sensitivity: "base",
      });
    });
  }

  function safeIconClass(s) {
    var t = String(s || "").trim();
    if (!/^[a-z0-9 \-_]+$/i.test(t) || t.length > 120) return "fas fa-wrench";
    return t;
  }

  function initNav() {
    var toggle = $("#navToggle");
    var nav = $("#mainNav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      nav.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () {
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }

    var path = (location.pathname || "").split("/").pop() || "index.html";
    if (path === "" || path === "/") path = "index.html";
    $$(".main-nav a").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (href.indexOf("http") === 0 || href.charAt(0) === "#") return;
      var file = href.split("/").pop() || href;
      if (file === path) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }

  /** Clear loading banners when not fetching remotely (optional CMS hook). */
  function clearStaticLoadHints() {
    $$("[data-content-status]").forEach(function (el) {
      setStatus(el, "", false);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    clearStaticLoadHints();
  });

  /** Optional hooks for CMS scripts: window.CEC_PUBLIC.applySiteContent(rows), etc. */
  window.CEC_PUBLIC = {
    applySiteContent: applySiteContent,
    sortSiteContentRows: sortSiteContentRows,
    renderServices: renderServices,
    renderPortfolio: renderPortfolio,
    setStatus: setStatus,
  };
})();
