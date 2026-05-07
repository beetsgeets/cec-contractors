/**
 * Phase 1 admin: Netlify Identity + Git Gateway (GitHub Contents API v3 proxy).
 * Loads/saves: content/home.yml, services.yml, about.yml, contact.yml, content/portfolio/*.md
 */
(function () {
  "use strict";

  var BRANCH;
  var OWNER;
  var REPO;
  var ORIGIN;
  var accessToken;
  var currentEdit = null;

  /** Direct .md portfolio items live here only. Listing: GET …/repos/{owner}/{repo}/contents/content/portfolio?ref={branch} (no trailing slash on path). */
  var PORTFOLIO_ITEMS_DIR = "content/portfolio";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function readMeta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el && el.getAttribute("content") ? el.getAttribute("content").trim() : "";
  }

  function showError(msg) {
    var bar = $("#dashError");
    if (!bar) return;
    bar.textContent = msg || "";
    bar.hidden = !msg;
  }

  function showToast(text) {
    var el = $("#dashToast");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    el.classList.add("is-visible");
    window.clearTimeout(showToast._tid);
    showToast._tid = window.setTimeout(function () {
      el.classList.remove("is-visible");
      el.hidden = true;
    }, 2800);
  }

  function decodeBase64Utf8(b64) {
    var binary = atob(String(b64 || "").replace(/\s/g, ""));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function authHeaders(json) {
    var h = { Accept: "application/vnd.github+json" };
    if (json) {
      h["Content-Type"] = "application/json";
    }
    if (accessToken) {
      h.Authorization = "Bearer " + accessToken;
    }
    return h;
  }

  function repoBase() {
    return (
      ORIGIN +
      "/.netlify/git/github/v3/repos/" +
      encodeURIComponent(OWNER) +
      "/" +
      encodeURIComponent(REPO)
    );
  }

  /** Strip leading/trailing slashes so /.netlify/git/github/v3/repos/.../contents/... never ends with / before ?ref= */
  function normalizeRepoPath(pathInRepo) {
    return String(pathInRepo || "")
      .replace(/^\/+/g, "")
      .replace(/\/+$/g, "")
      .replace(/\/+/g, "/");
  }

  function contentsURL(pathInRepo) {
    var raw = normalizeRepoPath(pathInRepo);
    var encPath = raw
      .split("/")
      .filter(function (p) {
        return p.length > 0;
      })
      .map(encodeURIComponent)
      .join("/");
    return repoBase() + "/contents/" + encPath + "?ref=" + encodeURIComponent(BRANCH);
  }

  function yamlDumpOpts() {
    return { lineWidth: -1, noRefs: true, sortKeys: false };
  }

  async function githubGET(pathInRepo) {
    var res = await fetch(contentsURL(pathInRepo), { headers: authHeaders(false) });
    var body = await res.json().catch(function () {
      return null;
    });
    if (!res.ok) {
      var err = new Error((body && body.message) || res.statusText);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  async function githubPUT(pathInRepo, payload) {
    var raw = normalizeRepoPath(pathInRepo);
    var encPath = raw
      .split("/")
      .filter(function (p) {
        return p.length > 0;
      })
      .map(encodeURIComponent)
      .join("/");
    var url = repoBase() + "/contents/" + encPath;
    var res = await fetch(url, {
      method: "PUT",
      headers: authHeaders(true),
      body: JSON.stringify(payload),
    });
    var body = await res.json().catch(function () {
      return null;
    });
    if (!res.ok) {
      throw new Error((body && body.message) || res.statusText);
    }
    return body;
  }

  async function fetchRepoFile(pathInRepo) {
    var payload = await githubGET(pathInRepo);
    if (Array.isArray(payload)) {
      throw new Error(pathInRepo + " is not a file");
    }
    if (!payload.content) {
      throw new Error("No file body returned");
    }
    return { text: decodeBase64Utf8(payload.content), sha: payload.sha };
  }

  async function saveYamlFile(pathInRepo, text, sha, message) {
    await githubPUT(pathInRepo, {
      message: message,
      content: utf8ToBase64(text),
      branch: BRANCH,
      sha: sha,
    });
  }

  function parseFrontmatterMd(raw) {
    var text = String(raw || "").replace(/^\uFEFF/, "");
    var m = text.match(/^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/);
    if (!m) {
      return { fm: {}, hadFence: false };
    }
    var fm = {};
    try {
      fm = jsyaml.load(m[1]) || {};
    } catch (e) {
      fm = {};
    }
    return { fm: fm, hadFence: true };
  }

  function stringifyFrontmatter(fm) {
    return "---\n" + jsyaml.dump(fm, yamlDumpOpts()).replace(/\s+$/, "") + "\n---\n";
  }

  function schemaHome() {
    return [
      { key: "title", label: "Page title (admin)", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "hero_headline", label: "Hero headline", type: "text" },
      { key: "hero_subtitle", label: "Hero subtitle", type: "textarea" },
      { key: "cta_label", label: "Primary button label", type: "text" },
      { key: "highlights_heading", label: "Highlights heading", type: "text" },
      { key: "highlights_lead", label: "Highlights intro", type: "textarea" },
      { key: "footer_tagline", label: "Footer tagline", type: "textarea" },
      {
        key: "highlight_cards",
        label: "Highlight cards",
        type: "objectList",
        itemLabel: "Card",
        itemFields: [
          { key: "title", label: "Title", type: "text" },
          { key: "body", label: "Text", type: "textarea" },
        ],
      },
    ];
  }

  function schemaServices() {
    return [
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "intro", label: "Intro", type: "textarea" },
      { key: "bullets", label: "Bullets", type: "stringList" },
    ];
  }

  function schemaAbout() {
    return [
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "intro_lead", label: "Intro", type: "textarea" },
      { key: "story_body", label: "Our story", type: "textarea" },
      { key: "team_body", label: "Who you'll meet", type: "textarea" },
      { key: "credentials_note", label: "Credentials note", type: "textarea" },
    ];
  }

  function schemaContact() {
    return [
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "intro", label: "Intro", type: "textarea" },
      { key: "hours_note", label: "Hours", type: "text" },
      { key: "service_area_note", label: "Service area", type: "textarea" },
    ];
  }

  function schemaPortfolio() {
    return [
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "category", label: "Category", type: "text" },
      { key: "order_index", label: "Order #", type: "number" },
      { key: "image", label: "Image URL", type: "text" },
    ];
  }

  function buildFieldControl(field, value, fid) {
    var wrap = document.createElement("div");
    wrap.className = "dash-field";
    var lab = document.createElement("label");
    lab.textContent = field.label;
    lab.htmlFor = fid;
    wrap.appendChild(lab);
    var el =
      field.type === "textarea"
        ? document.createElement("textarea")
        : field.type === "number"
          ? document.createElement("input")
          : document.createElement("input");
    if (field.type === "number") {
      el.type = "number";
      el.value = value != null ? String(Number(value)) : "0";
    } else if (field.type !== "textarea") {
      el.type = "text";
      el.value = value != null ? String(value) : "";
    } else {
      el.value = value != null ? String(value) : "";
    }
    el.id = fid;
    el.dataset.key = field.key;
    wrap.appendChild(el);
    return wrap;
  }

  function buildStringListControl(field, list) {
    var wrap = document.createElement("div");
    wrap.className = "dash-field";
    var lab = document.createElement("label");
    lab.textContent = field.label;
    wrap.appendChild(lab);
    var blk = document.createElement("div");
    blk.className = "dash-list-block";
    blk.dataset.list = field.key;
    var rows = Array.isArray(list) ? list.slice() : [];

    function addRow(val) {
      var row = document.createElement("div");
      row.className = "dash-list-row";
      var inp = document.createElement("input");
      inp.type = "text";
      inp.value = val != null ? String(val) : "";
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "dash-btn dash-btn-ghost";
      rm.textContent = "Remove";
      rm.addEventListener("click", function () {
        row.remove();
      });
      row.appendChild(inp);
      row.appendChild(rm);
      blk.appendChild(row);
    }

    rows.forEach(function (r) {
      addRow(r);
    });
    if (!rows.length) {
      addRow("");
    }
    var add = document.createElement("button");
    add.type = "button";
    add.className = "dash-btn dash-btn-ghost";
    add.style.marginTop = "0.5rem";
    add.textContent = "Add line";
    add.addEventListener("click", function () {
      addRow("");
    });
    wrap.appendChild(blk);
    wrap.appendChild(add);
    return wrap;
  }

  function buildObjectListControl(field, list) {
    var wrap = document.createElement("div");
    wrap.className = "dash-field";
    var lab = document.createElement("label");
    lab.textContent = field.label;
    wrap.appendChild(lab);
    var container = document.createElement("div");
    container.dataset.objectList = field.key;

    function appendCard(idx, obj) {
      obj = obj && typeof obj === "object" ? obj : {};
      var card = document.createElement("div");
      card.className = "dash-object-card";
      var head = document.createElement("div");
      head.className = "dash-object-card-header";
      var span = document.createElement("span");
      span.textContent = (field.itemLabel || "Item") + " " + (idx + 1);
      var del = document.createElement("button");
      del.type = "button";
      del.className = "dash-btn dash-btn-ghost";
      del.textContent = "Remove";
      del.addEventListener("click", function () {
        card.remove();
      });
      head.appendChild(span);
      head.appendChild(del);
      card.appendChild(head);
      (field.itemFields || []).forEach(function (sf) {
        var fid = idx + "-" + field.key + "-" + sf.key;
        var fv = obj[sf.key];
        var lw = document.createElement("div");
        lw.style.marginBottom = "0.6rem";
        var lb = document.createElement("label");
        lb.style.display = "block";
        lb.style.fontSize = "0.85rem";
        lb.style.fontWeight = "600";
        lb.htmlFor = fid;
        lb.textContent = sf.label;
        lw.appendChild(lb);
        if (sf.type === "textarea") {
          var ta = document.createElement("textarea");
          ta.id = fid;
          ta.dataset.subkey = sf.key;
          ta.value = fv != null ? String(fv) : "";
          ta.style.width = "100%";
          ta.rows = 3;
          lw.appendChild(ta);
        } else {
          var inp = document.createElement("input");
          inp.type = "text";
          inp.id = fid;
          inp.dataset.subkey = sf.key;
          inp.value = fv != null ? String(fv) : "";
          inp.style.width = "100%";
          lw.appendChild(inp);
        }
        card.appendChild(lw);
      });
      container.appendChild(card);
    }

    var arr = Array.isArray(list) ? list : [];
    arr.forEach(function (it, ix) {
      appendCard(ix, it);
    });
    if (!arr.length) {
      appendCard(0, {});
    }
    var addMore = document.createElement("button");
    addMore.type = "button";
    addMore.className = "dash-btn dash-btn-ghost";
    addMore.style.marginTop = "0.5rem";
    addMore.textContent = "Add card";
    addMore.addEventListener("click", function () {
      appendCard(container.querySelectorAll(".dash-object-card").length, {});
    });
    wrap.appendChild(container);
    wrap.appendChild(addMore);
    return wrap;
  }

  function gatherForm(panel, schema) {
    var out = {};
    schema.forEach(function (field) {
      if (field.type === "stringList") {
        var blk = panel.querySelector('[data-list="' + field.key + '"]');
        var vals = [];
        if (blk) {
          blk.querySelectorAll(".dash-list-row input").forEach(function (inp) {
            var t = inp.value.trim();
            if (t) {
              vals.push(t);
            }
          });
        }
        out[field.key] = vals;
        return;
      }
      if (field.type === "objectList") {
        var ob = panel.querySelector('[data-object-list="' + field.key + '"]');
        var rows = [];
        if (ob) {
          ob.querySelectorAll(".dash-object-card").forEach(function (card) {
            var row = {};
            card.querySelectorAll("[data-subkey]").forEach(function (el) {
              row[el.getAttribute("data-subkey")] = el.value;
            });
            rows.push(row);
          });
        }
        out[field.key] = rows;
        return;
      }
      var el = panel.querySelector('[data-key="' + field.key + '"]');
      if (!el) return;
      if (field.type === "number") {
        out[field.key] = Number(el.value) || 0;
      } else {
        out[field.key] = el.value;
      }
    });
    return out;
  }

  function renderFields(container, schema, data) {
    container.innerHTML = "";
    schema.forEach(function (field, i) {
      var fid = "f-" + field.key + "-" + i;
      var cur =
        data && Object.prototype.hasOwnProperty.call(data, field.key)
          ? data[field.key]
          : "";
      if (field.type === "stringList") {
        container.appendChild(buildStringListControl(field, cur));
      } else if (field.type === "objectList") {
        container.appendChild(buildObjectListControl(field, cur));
      } else {
        container.appendChild(buildFieldControl(field, cur, fid));
      }
    });
  }

  function showDashboardView() {
    $("#viewDashboard").hidden = false;
    $("#viewEditor").hidden = true;
    currentEdit = null;
    showError("");
  }

  function showEditorView(title) {
    $("#editorTitle").textContent = title;
    $("#viewDashboard").hidden = true;
    $("#viewEditor").hidden = false;
    showError("");
  }

  async function openYamlEditor(pathInRepo, pageLabel, schema) {
    showError("");
    showEditorView("Edit " + pageLabel);
    var body = $("#editorFields");
    body.innerHTML = '<div class="dash-loading">Loading…</div>';
    try {
      var got = await fetchRepoFile(pathInRepo);
      var data = {};
      try {
        data = jsyaml.load(got.text) || {};
      } catch (yp) {
        throw new Error("Invalid YAML in " + pathInRepo + ": " + yp.message);
      }
      currentEdit = {
        kind: "yaml",
        path: pathInRepo,
        label: pageLabel,
        sha: got.sha,
        schema: schema,
      };
      body.innerHTML = "";
      renderFields(body, schema, data);
      $("#saveBtn").onclick = async function () {
        try {
          var obj = gatherForm(body, schema);
          var yml = jsyaml.dump(obj, yamlDumpOpts()).replace(/\s+$/, "") + "\n";
          await saveYamlFile(pathInRepo, yml, currentEdit.sha, "Admin update: " + pageLabel);
          var nf = await fetchRepoFile(pathInRepo);
          currentEdit.sha = nf.sha;
          showToast("Saved!");
        } catch (err) {
          showError(err.message || String(err));
        }
      };
    } catch (e) {
      body.innerHTML = "";
      showError(e.message || String(e));
    }
  }

  async function openPortfolioEditor(repoPath, displayTitle) {
    showError("");
    showEditorView(displayTitle || "Portfolio item");
    var body = $("#editorFields");
    body.innerHTML = '<div class="dash-loading">Loading…</div>';
    try {
      var got = await fetchRepoFile(repoPath);
      var parsed = parseFrontmatterMd(got.text);
      if (!parsed.hadFence) parsed.fm = {};
      var schema = schemaPortfolio();
      currentEdit = { kind: "md", path: repoPath, sha: got.sha, schema: schema };
      body.innerHTML = "";
      renderFields(body, schema, parsed.fm);
      $("#saveBtn").onclick = async function () {
        try {
          var obj = gatherForm(body, schema);
          var md = stringifyFrontmatter(obj);
          await githubPUT(repoPath, {
            message: "Admin update: " + displayTitle,
            content: utf8ToBase64(md),
            branch: BRANCH,
            sha: currentEdit.sha,
          });
          var nf = await fetchRepoFile(repoPath);
          currentEdit.sha = nf.sha;
          showToast("Saved!");
        } catch (err) {
          showError(err.message || String(err));
        }
      };
    } catch (e) {
      body.innerHTML = "";
      showError(e.message || String(e));
    }
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  /** Keeps listing to direct children of content/portfolio; ignores content/pages/portfolio.md and subfolders. */
  function isDirectPortfolioMarkdownItem(entry) {
    if (!entry || entry.type !== "file") {
      return false;
    }
    var name = entry.name || "";
    if (!/\.md$/i.test(name)) {
      return false;
    }
    var path = entry.path || "";
    if (
      path === "content/pages/portfolio.md" ||
      path.indexOf("content/pages/") === 0
    ) {
      return false;
    }
    var prefix = PORTFOLIO_ITEMS_DIR + "/";
    if (path.indexOf(prefix) !== 0) {
      return false;
    }
    var rest = path.slice(prefix.length);
    if (rest.indexOf("/") >= 0 || !rest.length) {
      return false;
    }
    return true;
  }

  async function hydratePortfolioTiles() {
    var mount = $("#portfolioTiles");
    if (!mount) return;
    mount.innerHTML = '<div class="dash-loading">Loading portfolio files…</div>';
    try {
      var listing = await githubGET(PORTFOLIO_ITEMS_DIR);
      if (!Array.isArray(listing)) {
        console.error("Portfolio listing error:", listing);
        mount.innerHTML =
          '<p class="dash-muted" style="grid-column:1/-1;">No portfolio listing.</p>';
        return;
      }
      mount.innerHTML = "";
      listing
        .filter(isDirectPortfolioMarkdownItem)
        .sort(function (a, b) {
          return String(a.name).localeCompare(String(b.name));
        })
        .forEach(function (entry) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "dash-tile dash-portfolio-card";
          var title = String(entry.name).replace(/\.md$/i, "").replace(/-/g, " ");
          btn.innerHTML =
            "<h3>" +
            escapeHtml(title) +
            "</h3><p>" +
            escapeHtml(entry.path || "") +
            "</p>";
          btn.addEventListener("click", function () {
            openPortfolioEditor(entry.path, "Portfolio — " + title);
          });
          mount.appendChild(btn);
        });
      if (!mount.children.length) {
        mount.innerHTML =
          '<p class="dash-muted" style="grid-column:1/-1;">No .md files in content/portfolio/.</p>';
      }
    } catch (e) {
      mount.innerHTML = "";
      var p = document.createElement("p");
      p.className = "dash-error";
      p.style.margin = "0";
      p.style.gridColumn = "1 / -1";
      p.textContent = "Could not list portfolio: " + (e.message || String(e));
      mount.appendChild(p);
    }
  }

  function parseRepoMeta() {
    var raw = readMeta("cec:github-repo");
    if (!raw || raw.indexOf("/") < 0) return false;
    var bits = raw.split("/").filter(Boolean);
    OWNER = bits[0];
    REPO = bits.slice(1).join("/");
    BRANCH = readMeta("cec:github-branch") || "main";
    ORIGIN = window.location.origin;
    return !!(OWNER && REPO);
  }

  function wireTiles() {
    $("#tileHome").addEventListener("click", function () {
      openYamlEditor("content/home.yml", "Home Page", schemaHome());
    });
    $("#tileServices").addEventListener("click", function () {
      openYamlEditor("content/services.yml", "Services", schemaServices());
    });
    $("#tileAbout").addEventListener("click", function () {
      openYamlEditor("content/about.yml", "About Page", schemaAbout());
    });
    $("#tileContact").addEventListener("click", function () {
      openYamlEditor("content/contact.yml", "Contact Info", schemaContact());
    });
    $("#logoutBtn").addEventListener("click", function () {
      netlifyIdentity.logout();
      window.location.href = "/";
    });
    $("#backBtn").addEventListener("click", function () {
      showDashboardView();
      hydratePortfolioTiles();
    });
  }

  async function boot(user) {
    accessToken = user.token && user.token.access_token ? user.token.access_token : "";
    $("#dashUserEmail").textContent =
      "Logged in as: " + (user.email || (user.id != null ? String(user.id) : "Signed in"));

    if (!parseRepoMeta()) {
      showError('Set meta name="cec:github-repo" content="owner/repo" in dashboard.html.');
      ["tileHome", "tileServices", "tileAbout", "tileContact"].forEach(function (id) {
        var x = $("#" + id);
        if (x) x.disabled = true;
      });
      return;
    }
    if (!accessToken) {
      showError("Missing Identity token — enable Netlify Identity + Git Gateway.");
      return;
    }
    wireTiles();
    hydratePortfolioTiles();
  }

  function start() {
    if (typeof netlifyIdentity === "undefined") {
      showError("Netlify Identity script failed to load.");
      return;
    }
    if (typeof jsyaml === "undefined") {
      showError("js-yaml failed to load.");
      return;
    }
    netlifyIdentity.on("init", function (user) {
      if (!user) {
        window.location.replace("/");
        return;
      }
      boot(user).catch(function (err) {
        showError(err.message || String(err));
      });
    });
    netlifyIdentity.on("logout", function () {
      window.location.replace("/");
    });
    netlifyIdentity.init();
  }

  document.addEventListener("DOMContentLoaded", start);
})();
