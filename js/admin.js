/**
 * CEC Contractors — admin login (admin.html) and dashboard (dashboard.html)
 */

(function () {
  "use strict";

  var BUCKET = "portfolio-images";

  /** Unsubscribe from dashboard auth listener (set in initDashboard). */
  var dashboardAuthUnsubscribe = null;

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

  /** ---------- Admin login ---------- */
  function initLogin() {
    var form = $("#loginForm");
    var msg = $("#loginMsg");
    if (!form) return;

    var sb = getSupabaseClient();
    if (!sb) {
      showMsg(msg, "Supabase is not configured. Add js/config.js (copy from config.example.js).", true);
      return;
    }

    sb.auth.getSession().then(function (_ref) {
      var session = _ref.data && _ref.data.session;
      if (session) {
        location.href = "dashboard.html";
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      showMsg(msg, "Signing in…", false);
      var email = ($("#loginEmail") && $("#loginEmail").value) || "";
      var password = ($("#loginPassword") && $("#loginPassword").value) || "";
      sb.auth
        .signInWithPassword({ email: email.trim(), password: password })
        .then(function (res) {
          if (res.error) throw res.error;
          showMsg(msg, "Success. Redirecting…", false);
          var next = new URLSearchParams(location.search).get("next") || "dashboard.html";
          if (next.indexOf("/") === 0 || next.indexOf("http") === 0) next = "dashboard.html";
          location.href = next;
        })
        .catch(function (err) {
          showMsg(msg, err.message || "Login failed.", true);
        });
    });
  }

  /** ---------- Dashboard guard & layout ---------- */
  function initDashboard() {
    var sb = getSupabaseClient();
    if (!sb) {
      location.href = "admin.html";
      return;
    }

    var redirectLogin = "admin.html?next=" + encodeURIComponent("dashboard.html");
    /** True only after session + refreshSession + tick; table queries run only after this. */
    var dashboardDataLoadsStarted = false;

    /**
     * Wait for GoTrue to emit INITIAL_SESSION (session may not be in storage yet on first paint).
     */
    function waitForInitialSessionOnce() {
      return new Promise(function (resolve) {
        var resolved = false;
        var timeoutId = setTimeout(function () {
          if (resolved) return;
          resolved = true;
          resolve(null);
        }, 8000);
        var wrapped = sb.auth.onAuthStateChange(function (event, session) {
          if (event !== "INITIAL_SESSION") return;
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          if (wrapped && wrapped.data && wrapped.data.subscription) {
            wrapped.data.subscription.unsubscribe();
          }
          resolve(session || null);
        });
      });
    }

    /** All site_content / services / portfolio_items loads run only inside this async path. */
    async function bootstrapDashboardDataLoads() {
      try {
        var r = await sb.auth.getSession();
        if (r.error) throw r.error;
        var session = r.data && r.data.session;
        if (!session || !session.access_token) {
          session = await waitForInitialSessionOnce();
        }
        if (!session || !session.access_token) {
          location.href = redirectLogin;
          return;
        }

        var refreshed = await sb.auth.refreshSession();
        if (refreshed.error) {
          console.warn("[CEC] refreshSession:", refreshed.error.message);
        }

        await new Promise(function (res) {
          setTimeout(res, 0);
        });

        var verify = await sb.auth.getSession();
        if (verify.error) throw verify.error;
        var s2 = verify.data && verify.data.session;
        if (!s2 || !s2.access_token) {
          location.href = redirectLogin;
          return;
        }

        if (dashboardDataLoadsStarted) return;
        dashboardDataLoadsStarted = true;
        runDashboard(sb);
      } catch (err) {
        console.warn("[CEC] dashboard bootstrap:", err);
        location.href = redirectLogin;
      }
    }

    var authSub = sb.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") {
        dashboardDataLoadsStarted = false;
        if (dashboardAuthUnsubscribe) {
          dashboardAuthUnsubscribe();
          dashboardAuthUnsubscribe = null;
        }
        location.href = "admin.html";
        return;
      }
      if (dashboardDataLoadsStarted && !session) {
        location.href = redirectLogin;
        return;
      }
      if (event === "TOKEN_REFRESHED" && session) {
        console.debug("[CEC] Session token refreshed");
      }
    });
    dashboardAuthUnsubscribe =
      authSub && authSub.data && authSub.data.subscription
        ? function () {
            authSub.data.subscription.unsubscribe();
          }
        : null;

    void bootstrapDashboardDataLoads();
  }

  function runDashboard(sb) {
    $("#logoutBtn") &&
      $("#logoutBtn").addEventListener("click", function () {
        if (dashboardAuthUnsubscribe) {
          dashboardAuthUnsubscribe();
          dashboardAuthUnsubscribe = null;
        }
        sb.auth.signOut().then(function () {
          resetSupabaseClient();
          location.href = "admin.html";
        });
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

    loadSiteContentEditor(sb);
    loadPortfolioEditor(sb);
    loadServicesEditor(sb);
  }

  /** Stable sort for site_content rows (page → section → key). Avoids chained .order() REST bugs. */
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

  /** ---------- site_content ---------- */
  function loadSiteContentEditor(sb) {
    var tbody = $("#siteContentBody");
    var status = $("#contentEditorStatus");
    if (!tbody) return;

    function refresh() {
      showMsg(status, "Loading…", false);
      sb.from("site_content")
        .select("id,page,section,content_key,content_value")
        .then(function (res) {
          if (res.error) throw res.error;
          showMsg(status, "", false);
          tbody.innerHTML = "";
          sortSiteContentRows(res.data || []).forEach(function (row) {
            var tr = document.createElement("tr");
            tr.setAttribute("data-id", row.id);
            ["page", "section", "content_key"].forEach(function (key) {
              var td = document.createElement("td");
              td.textContent = row[key] != null ? String(row[key]) : "";
              tr.appendChild(td);
            });
            var tdVal = document.createElement("td");
            var ta = document.createElement("textarea");
            ta.className = "js-sc-val";
            ta.rows = 3;
            ta.value = row.content_value != null ? String(row.content_value) : "";
            tdVal.appendChild(ta);
            tr.appendChild(tdVal);
            var tdBtn = document.createElement("td");
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn-secondary btn-sm js-sc-save";
            btn.textContent = "Save";
            tdBtn.appendChild(btn);
            tr.appendChild(tdBtn);
            tbody.appendChild(tr);

            btn.addEventListener("click", function () {
              var val = ta.value;
              btn.disabled = true;
              sb.from("site_content")
                .update({ content_value: val })
                .eq("id", row.id)
                .then(function (r) {
                  btn.disabled = false;
                  if (r.error) throw r.error;
                  showMsg(status, "Saved row.", false);
                })
                .catch(function (e) {
                  btn.disabled = false;
                  showMsg(status, e.message || "Save failed", true);
                });
            });
          });
        })
        .catch(function (e) {
          showMsg(status, e.message || "Load failed", true);
        });
    }

    $("#refreshSiteContentBtn") &&
      $("#refreshSiteContentBtn").addEventListener("click", refresh);
    refresh();
  }

  /** ---------- Portfolio ---------- */
  function loadPortfolioEditor(sb) {
    var tbody = $("#portfolioBody");
    var status = $("#portfolioEditorStatus");
    var addForm = $("#portfolioAddForm");
    if (!tbody) return;

    function publicUrl(path) {
      var out = sb.storage.from(BUCKET).getPublicUrl(path);
      return out && out.data && out.data.publicUrl ? out.data.publicUrl : "";
    }

    function refresh() {
      showMsg(status, "Loading…", false);
      sb.from("portfolio_items")
        .select("id,title,description,image_url,category,order_index")
        .order("order_index", { ascending: true })
        .then(function (res) {
          if (res.error) throw res.error;
          showMsg(status, "", false);
          tbody.innerHTML = (res.data || [])
            .map(function (row) {
              return (
                "<tr data-id=\"" +
                row.id +
                "\" data-order=\"" +
                row.order_index +
                "\">" +
                "<td><img class=\"thumb-sm\" src=\"" +
                escapeAttr(row.image_url || "") +
                "\" alt=\"\" /></td>" +
                "<td><input type=\"text\" class=\"js-p-title\" value=\"" +
                escapeAttr(row.title || "") +
                "\" /></td>" +
                "<td><textarea class=\"js-p-desc\" rows=\"2\">" +
                escapeHtml(row.description || "") +
                "</textarea></td>" +
                "<td><input type=\"text\" class=\"js-p-cat\" value=\"" +
                escapeAttr(row.category || "") +
                "\" /></td>" +
                "<td><input type=\"number\" class=\"js-p-order\" value=\"" +
                String(row.order_index != null ? row.order_index : 0) +
                "\" /></td>" +
                "<td class=\"row-actions\">" +
                "<button type=\"button\" class=\"btn btn-ghost btn-sm js-p-save\">Save</button>" +
                "<button type=\"button\" class=\"btn btn-ghost btn-sm js-p-img\">New image</button>" +
                "<input type=\"file\" accept=\"image/*\" class=\"js-p-file\" hidden />" +
                "<button type=\"button\" class=\"btn btn-ghost btn-sm js-p-del\">Delete</button>" +
                "</td>" +
                "</tr>"
              );
            })
            .join("");

          bindPortfolioRows(sb, tbody, status);
        })
        .catch(function (e) {
          showMsg(status, e.message || "Load failed", true);
        });
    }

    tbody.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var imgBtn = t.closest(".js-p-img");
      if (!imgBtn) return;
      var tr = imgBtn.closest("tr");
      if (!tr) return;
      var input = tr.querySelector(".js-p-file");
      if (input) input.click();
    });

    tbody.addEventListener("change", function (e) {
      var f = e.target;
      if (!f || !f.classList || !f.classList.contains("js-p-file") || !f.files || !f.files[0]) return;
      var tr = f.closest("tr");
      if (!tr) return;
      var id = tr.getAttribute("data-id");
      var file = f.files[0];
      var path = Date.now() + "-" + file.name.replace(/[^\w.\-]/g, "_");
      showMsg(status, "Uploading image…", false);
      sb.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: true })
        .then(function (up) {
          if (up.error) throw up.error;
          var uploadedPath = up.data && (up.data.path || (up.data[0] && up.data[0].path));
          if (!uploadedPath) throw new Error("Upload did not return a file path.");
          var url = publicUrl(uploadedPath);
          return sb.from("portfolio_items").update({ image_url: url }).eq("id", id).then(function (r2) {
            if (r2.error) throw r2.error;
            showMsg(status, "Image updated.", false);
            refresh();
          });
        })
        .catch(function (err) {
          showMsg(status, err.message || "Upload failed", true);
        });
      f.value = "";
    });

    function bindPortfolioRows(sb, tbody, status) {
      tbody.querySelectorAll(".js-p-save").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var tr = btn.closest("tr");
          if (!tr) return;
          var id = tr.getAttribute("data-id");
          var payload = {
            title: (tr.querySelector(".js-p-title") && tr.querySelector(".js-p-title").value) || "",
            description: (tr.querySelector(".js-p-desc") && tr.querySelector(".js-p-desc").value) || "",
            category: (tr.querySelector(".js-p-cat") && tr.querySelector(".js-p-cat").value) || "",
            order_index: parseInt(
              (tr.querySelector(".js-p-order") && tr.querySelector(".js-p-order").value) || "0",
              10
            ),
          };
          btn.disabled = true;
          sb.from("portfolio_items")
            .update(payload)
            .eq("id", id)
            .then(function (r) {
              btn.disabled = false;
              if (r.error) throw r.error;
              showMsg(status, "Portfolio item saved.", false);
            })
            .catch(function (e) {
              btn.disabled = false;
              showMsg(status, e.message || "Save failed", true);
            });
        });
      });
      tbody.querySelectorAll(".js-p-del").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!confirm("Delete this portfolio item?")) return;
          var tr = btn.closest("tr");
          if (!tr) return;
          var id = tr.getAttribute("data-id");
          sb.from("portfolio_items")
            .delete()
            .eq("id", id)
            .then(function (r) {
              if (r.error) throw r.error;
              showMsg(status, "Deleted.", false);
              refresh();
            })
            .catch(function (e) {
              showMsg(status, e.message || "Delete failed", true);
            });
        });
      });
    }

    if (addForm) {
      addForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var title = ($("#newPTitle") && $("#newPTitle").value) || "";
        var description = ($("#newPDesc") && $("#newPDesc").value) || "";
        var category = ($("#newPCat") && $("#newPCat").value) || "";
        var fileInput = $("#newPFile");
        var file = fileInput && fileInput.files && fileInput.files[0];
        if (!file) {
          showMsg(status, "Choose an image file for the new item.", true);
          return;
        }
        var path = Date.now() + "-" + file.name.replace(/[^\w.\-]/g, "_");
        showMsg(status, "Creating…", false);
        sb.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: false })
          .then(function (up) {
            if (up.error) throw up.error;
            var uploadedPath = up.data && (up.data.path || (up.data[0] && up.data[0].path));
            if (!uploadedPath) throw new Error("Upload did not return a file path.");
            var url = publicUrl(uploadedPath);
            return sb
              .from("portfolio_items")
              .select("order_index")
              .order("order_index", { ascending: false })
              .limit(1)
              .then(function (mx) {
                var nextOrder = 0;
                if (!mx.error && mx.data && mx.data[0] && mx.data[0].order_index != null) {
                  nextOrder = Number(mx.data[0].order_index) + 1;
                }
                return sb
                  .from("portfolio_items")
                  .insert({
                    title: title,
                    description: description,
                    image_url: url,
                    category: category,
                    order_index: nextOrder,
                  })
                  .then(function (ins) {
                    if (ins.error) throw ins.error;
                    showMsg(status, "Portfolio item added.", false);
                    addForm.reset();
                    refresh();
                  });
              });
          })
          .catch(function (err) {
            showMsg(status, err.message || "Could not add item", true);
          });
      });
    }

    $("#refreshPortfolioBtn") &&
      $("#refreshPortfolioBtn").addEventListener("click", refresh);
    refresh();
  }

  /** ---------- Services ---------- */
  function loadServicesEditor(sb) {
    var tbody = $("#servicesBody");
    var status = $("#servicesEditorStatus");
    var addForm = $("#serviceAddForm");
    if (!tbody) return;

    function refresh() {
      showMsg(status, "Loading…", false);
      sb.from("services")
        .select("id,title,description,icon_class,order_index")
        .order("order_index", { ascending: true })
        .then(function (res) {
          if (res.error) throw res.error;
          showMsg(status, "", false);
          tbody.innerHTML = (res.data || [])
            .map(function (row) {
              return (
                "<tr data-id=\"" +
                row.id +
                "\">" +
                "<td><input type=\"text\" class=\"js-s-title\" value=\"" +
                escapeAttr(row.title || "") +
                "\" /></td>" +
                "<td><textarea class=\"js-s-desc\" rows=\"2\">" +
                escapeHtml(row.description || "") +
                "</textarea></td>" +
                "<td><input type=\"text\" class=\"js-s-icon\" value=\"" +
                escapeAttr(row.icon_class || "") +
                "\" placeholder=\"fas fa-hammer\" /></td>" +
                "<td><input type=\"number\" class=\"js-s-order\" value=\"" +
                String(row.order_index != null ? row.order_index : 0) +
                "\" /></td>" +
                "<td class=\"row-actions\">" +
                "<button type=\"button\" class=\"btn btn-ghost btn-sm js-s-save\">Save</button>" +
                "<button type=\"button\" class=\"btn btn-ghost btn-sm js-s-del\">Delete</button>" +
                "</td>" +
                "</tr>"
              );
            })
            .join("");

          tbody.querySelectorAll(".js-s-save").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var tr = btn.closest("tr");
              if (!tr) return;
              var id = tr.getAttribute("data-id");
              var payload = {
                title: (tr.querySelector(".js-s-title") && tr.querySelector(".js-s-title").value) || "",
                description: (tr.querySelector(".js-s-desc") && tr.querySelector(".js-s-desc").value) || "",
                icon_class: (tr.querySelector(".js-s-icon") && tr.querySelector(".js-s-icon").value) || "fas fa-wrench",
                order_index: parseInt(
                  (tr.querySelector(".js-s-order") && tr.querySelector(".js-s-order").value) || "0",
                  10
                ),
              };
              btn.disabled = true;
              sb.from("services")
                .update(payload)
                .eq("id", id)
                .then(function (r) {
                  btn.disabled = false;
                  if (r.error) throw r.error;
                  showMsg(status, "Service saved.", false);
                })
                .catch(function (e) {
                  showMsg(status, e.message || "Save failed", true);
                });
            });
          });
          tbody.querySelectorAll(".js-s-del").forEach(function (btn) {
            btn.addEventListener("click", function () {
              if (!confirm("Delete this service?")) return;
              var tr = btn.closest("tr");
              if (!tr) return;
              var id = tr.getAttribute("data-id");
              sb.from("services")
                .delete()
                .eq("id", id)
                .then(function (r) {
                  if (r.error) throw r.error;
                  showMsg(status, "Deleted.", false);
                  refresh();
                })
                .catch(function (e) {
                  showMsg(status, e.message || "Delete failed", true);
                });
            });
          });
        })
        .catch(function (e) {
          showMsg(status, e.message || "Load failed", true);
        });
    }

    if (addForm) {
      addForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var title = ($("#newSTitle") && $("#newSTitle").value) || "";
        var description = ($("#newSDesc") && $("#newSDesc").value) || "";
        var icon = ($("#newSIcon") && $("#newSIcon").value) || "fas fa-wrench";
        showMsg(status, "Adding…", false);
        sb.from("services")
          .select("order_index")
          .order("order_index", { ascending: false })
          .limit(1)
          .then(function (mx) {
            var nextOrder = 0;
            if (!mx.error && mx.data && mx.data[0] && mx.data[0].order_index != null) {
              nextOrder = Number(mx.data[0].order_index) + 1;
            }
            return sb
              .from("services")
              .insert({
                title: title,
                description: description,
                icon_class: icon,
                order_index: nextOrder,
              })
              .then(function (ins) {
                if (ins.error) throw ins.error;
                showMsg(status, "Service added.", false);
                addForm.reset();
                refresh();
              });
          })
          .catch(function (err) {
            showMsg(status, err.message || "Add failed", true);
          });
      });
    }

    $("#refreshServicesBtn") &&
      $("#refreshServicesBtn").addEventListener("click", refresh);
    refresh();
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var pg = pageName();
    if (pg === "admin.html") {
      initLogin();
    } else if (pg === "dashboard.html") {
      initDashboard();
    }
  });
})();
