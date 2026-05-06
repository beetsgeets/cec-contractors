/**
 * CEC Contractors — dashboard (dashboard.html)
 * Editing happens in Netlify CMS at /cms/. UI interactions only here.
 */

(function () {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function showMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
    el.classList.toggle("admin-msg--error", !!isError && !!text);
    el.classList.toggle("admin-msg--ok", !isError && !!text);
  }

  function pageName() {
    var p = (location.pathname || "").split("/").pop() || "";
    return p.toLowerCase();
  }

  /** ---------- Dashboard ---------- */
  function initDashboard() {
    runDashboard();
  }

  function runDashboard() {
    $("#logoutBtn") &&
      $("#logoutBtn").addEventListener("click", function () {
        location.href = "index.html";
      });

    $$(".dash-nav a[data-panel]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var panel = a.getAttribute("data-panel");
        $$(".dash-nav a").forEach(function (x) {
          x.classList.toggle("is-active", x === a);
        });
        $$(".dash-section").forEach(function (sec) {
          sec.classList.toggle("is-visible", sec.id === "panel-" + panel);
        });
      });
    });

    dashboardEditorsPlaceholder();
  }

  /** Tables stay empty until CMS/API integration replaces this. */
  function dashboardEditorsPlaceholder() {
    var sc = $("#contentEditorStatus");
    var pb = $("#portfolioEditorStatus");
    var sv = $("#servicesEditorStatus");
    if (sc) showMsg(sc, "Connect your CMS or API to edit site_content rows.", false);
    if (pb) showMsg(pb, "Portfolio uploads will use your CMS or storage once wired.", false);
    if (sv) showMsg(sv, "Service rows load here after CMS/API integration.", false);
    var tb = $("#siteContentBody");
    if (tb) tb.innerHTML = "";
    var pbBody = $("#portfolioBody");
    if (pbBody) pbBody.innerHTML = "";
    var svBody = $("#servicesBody");
    if (svBody) svBody.innerHTML = "";

    $("#refreshSiteContentBtn") &&
      $("#refreshSiteContentBtn").addEventListener("click", function () {
        if (sc) showMsg(sc, "Reload will fetch from CMS/API when integrated.", false);
      });
    $("#refreshPortfolioBtn") &&
      $("#refreshPortfolioBtn").addEventListener("click", function () {
        if (pb) showMsg(pb, "Reload will fetch from CMS/API when integrated.", false);
      });
    $("#refreshServicesBtn") &&
      $("#refreshServicesBtn").addEventListener("click", function () {
        if (sv) showMsg(sv, "Reload will fetch from CMS/API when integrated.", false);
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var pg = pageName();
    if (pg === "dashboard.html") {
      initDashboard();
    }
  });
})();
