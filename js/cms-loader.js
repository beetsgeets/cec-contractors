/**
 * Loads Markdown + YAML from content/ via the GitHub API (same commits Netlify CMS pushes).
 * Falls back to same-origin fetches when no repo is configured (works with deployed static files).
 *
 * Configure either:
 *   <meta name="cec:github-repo" content="owner/repo" />
 *   <meta name="cec:github-branch" content="main" />   (optional)
 * or window.CEC_CMS_CONFIG before this script runs:
 *   { github: { owner, repo, branch }, token?: string }
 *
 * Requires js-yaml before this file (global jsyaml.load).
 */
(function () {
  "use strict";

  function $(sel) {
    return document.querySelector(sel);
  }

  function meta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el && el.getAttribute("content") ? el.getAttribute("content").trim() : "";
  }

  function parseGithubRepo(str) {
    if (!str || str.indexOf("/") < 0) return null;
    var parts = str.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts.slice(1).join("/") };
  }

  function getConfig() {
    var base = window.CEC_CMS_CONFIG || {};
    var gh = base.github || {};
    var fromMeta = meta("cec:github-repo");
    var parsed = parseGithubRepo(fromMeta);
    var owner = gh.owner || (parsed && parsed.owner);
    var repo = gh.repo || (parsed && parsed.repo);
    var branch = gh.branch || meta("cec:github-branch") || "main";
    var token = gh.token || base.token || "";
    return {
      owner: owner,
      repo: repo,
      branch: branch,
      token: token,
      useGithub: !!(owner && repo),
    };
  }

  function yamlLoad(src) {
    var lib = typeof jsyaml !== "undefined" ? jsyaml : typeof jsYAML !== "undefined" ? jsYAML : null;
    if (lib && lib.load) return lib.load(src);
    throw new Error("js-yaml not loaded — include js-yaml before cms-loader.js");
  }

  function splitMarkdown(raw) {
    var text = String(raw || "").replace(/^\uFEFF/, "");
    var m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!m) return { data: {}, body: text };
    var data = yamlLoad(m[1]) || {};
    return { data: data, body: m[2] };
  }

  /** Normalize page markdown into applySiteContent rows: { page, section, content_key, content_value } */
  function rowsFromPageData(data) {
    var rows = [];
    if (!data || typeof data !== "object") return rows;

    if (Array.isArray(data.rows)) {
      data.rows.forEach(function (r) {
        if (!r || typeof r !== "object") return;
        if (r.page == null || r.section == null || r.content_key == null) return;
        rows.push({
          page: String(r.page),
          section: String(r.section),
          content_key: String(r.content_key),
          content_value: r.content_value != null ? String(r.content_value) : "",
        });
      });
      return rows;
    }

    if (
      data.page != null &&
      data.section != null &&
      data.content_key != null &&
      data.content_value != null
    ) {
      rows.push({
        page: String(data.page),
        section: String(data.section),
        content_key: String(data.content_key),
        content_value: String(data.content_value),
      });
    }

    return rows;
  }

  function normalizeService(data, filename) {
    return {
      id: filename || "",
      title: data.title != null ? String(data.title) : "",
      description: data.description != null ? String(data.description) : "",
      icon_class: data.icon_class != null ? String(data.icon_class) : "fas fa-wrench",
      order_index: Number(data.order_index) || 0,
    };
  }

  function normalizePortfolio(data, filename) {
    var img = data.image != null ? String(data.image) : "";
    return {
      id: filename || "",
      title: data.title != null ? String(data.title) : "",
      description: data.description != null ? String(data.description) : "",
      image_url: img,
      category: data.category != null ? String(data.category) : "",
      order_index: Number(data.order_index) || 0,
    };
  }

  function sortByOrder(arr) {
    return arr.slice().sort(function (a, b) {
      var ao = Number(a.order_index) || 0;
      var bo = Number(b.order_index) || 0;
      if (ao !== bo) return ao - bo;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }

  var STATIC_MARKDOWN_PATHS = [
    "content/pages/home.md",
    "content/pages/about.md",
    "content/pages/services.md",
    "content/pages/portfolio.md",
    "content/pages/contact.md",
    "content/services/finish-carpentry.md",
    "content/services/restoration.md",
    "content/services/commercial-coordination.md",
    "content/portfolio/custom-millwork-suite.md",
    "content/portfolio/historic-stair-restoration.md",
  ];

  function fetchRawFile(url, cfg) {
    var headers = {};
    if (cfg.token) headers.Authorization = "Bearer " + cfg.token;
    return fetch(url, { headers: headers, credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
      return res.text();
    });
  }

  function githubRawUrl(owner, repo, branch, path) {
    return (
      "https://raw.githubusercontent.com/" +
      encodeURIComponent(owner) +
      "/" +
      encodeURIComponent(repo) +
      "/" +
      encodeURIComponent(branch) +
      "/" +
      path
        .split("/")
        .map(function (seg) {
          return encodeURIComponent(seg);
        })
        .join("/")
    );
  }

  function githubApiTrees(owner, repo, branch, cfg) {
    var headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (cfg.token) headers.Authorization = "Bearer " + cfg.token;
    var url =
      "https://api.github.com/repos/" +
      encodeURIComponent(owner) +
      "/" +
      encodeURIComponent(repo) +
      "/git/trees/" +
      encodeURIComponent(branch) +
      "?recursive=1";
    return fetch(url, { headers: headers, credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error("GitHub tree API HTTP " + res.status);
      return res.json();
    });
  }

  function discoverMarkdownPaths(cfg) {
    if (!cfg.useGithub) return Promise.resolve(null);

    return githubApiTrees(cfg.owner, cfg.repo, cfg.branch, cfg)
      .then(function (json) {
        var paths = [];
        (json.tree || []).forEach(function (entry) {
          if (entry.type !== "blob" || !entry.path) return;
          var p = entry.path.replace(/\\/g, "/");
          if (!/^content\/(pages|services|portfolio)\/.+\.md$/i.test(p)) return;
          paths.push(p);
        });
        paths.sort();
        return paths.length ? paths : STATIC_MARKDOWN_PATHS.slice();
      })
      .catch(function (err) {
        console.warn("[CEC CMS] GitHub tree discovery failed; using built-in path list.", err);
        return STATIC_MARKDOWN_PATHS.slice();
      });
  }

  function fetchMarkdownViaGithub(paths, cfg) {
    var tasks = paths.map(function (path) {
      var url = githubRawUrl(cfg.owner, cfg.repo, cfg.branch, path);
      return fetchRawFile(url, cfg).then(function (text) {
        return { path: path, text: text };
      });
    });
    return Promise.all(tasks);
  }

  function fetchMarkdownViaSameOrigin(paths) {
    var tasks = paths.map(function (path) {
      return fetch(path, { credentials: "same-origin" }).then(function (res) {
        if (!res.ok) throw new Error("Missing file on server: " + path + " (" + res.status + ")");
        return res.text().then(function (text) {
          return { path: path, text: text };
        });
      });
    });
    return Promise.all(tasks);
  }

  function processFiles(files, pub) {
    var siteRows = [];
    var services = [];
    var portfolio = [];

    files.forEach(function (item) {
      var path = item.path.replace(/\\/g, "/");
      var parsed = splitMarkdown(item.text);
      var data = parsed.data || {};

      if (path.indexOf("content/pages/") === 0) {
        siteRows = siteRows.concat(rowsFromPageData(data));
        return;
      }

      if (path.indexOf("content/services/") === 0) {
        var fn = path.split("/").pop() || "";
        services.push(normalizeService(data, fn));
        return;
      }

      if (path.indexOf("content/portfolio/") === 0) {
        var pfn = path.split("/").pop() || "";
        portfolio.push(normalizePortfolio(data, pfn));
      }
    });

    if (siteRows.length && pub.sortSiteContentRows) {
      siteRows = pub.sortSiteContentRows(siteRows);
    }

    pub.applySiteContent(siteRows);

    var svcMount = $("#services-mount");
    if (svcMount && pub.renderServices) {
      pub.renderServices(svcMount, sortByOrder(services));
    }

    var portMount = $("#portfolio-mount");
    if (portMount && pub.renderPortfolio) {
      pub.renderPortfolio(portMount, sortByOrder(portfolio));
    }

    var statusEls = document.querySelectorAll("[data-content-status]");
    if (statusEls.length && pub.setStatus) {
      statusEls.forEach(function (el) {
        pub.setStatus(el, "", false);
      });
    }
  }

  function showLoadError(pub, message) {
    var els = document.querySelectorAll("[data-content-status]");
    if (!els.length) return;
    var msg = message || "Unable to load CMS content.";
    els.forEach(function (el) {
      if (pub && pub.setStatus) pub.setStatus(el, msg, true);
      else {
        el.textContent = msg;
        el.hidden = false;
        el.classList.add("content-status--error");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var pub = window.CEC_PUBLIC;
    if (!pub || typeof pub.applySiteContent !== "function") {
      console.warn("[CEC CMS] window.CEC_PUBLIC missing — load js/main.js before cms-loader.js");
      return;
    }

    var cfg = getConfig();

    discoverMarkdownPaths(cfg)
      .then(function (pathsFromApi) {
        var paths =
          pathsFromApi && pathsFromApi.length
            ? pathsFromApi
            : STATIC_MARKDOWN_PATHS.slice();

        if (cfg.useGithub) {
          return fetchMarkdownViaGithub(paths, cfg);
        }
        return fetchMarkdownViaSameOrigin(paths);
      })
      .then(function (files) {
        processFiles(files, pub);
      })
      .catch(function (err) {
        console.error("[CEC CMS]", err);
        showLoadError(pub, err.message || String(err));
      });
  });
})();
