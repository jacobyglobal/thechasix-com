/* The ChasIX Stock Watchlist: fetches the committed WatchList output from the
   API and renders a sortable/searchable table with a column-guide accordion. */
(function () {
  "use strict";

  var API_ROOT = window.API_ROOT || "https://api.thechasix.com";

  /* Per-column display formatting (column names are the CSV headers). */
  var FMT_DATE = { Date: 1 };
  var FMT_PRICE = {
    Open: 1, High: 1, Low: 1, Close: 1, "Typical Price (TP)": 1, "True Range (TR)": 1,
    "Average True Range (ATR)": 1, "52-Week High": 1, "52-Week Low": 1, "52-Week Range Position": 1
  };
  var FMT_PCT1 = {
    "Normalized ATR (NATR)": 1, "TD Range Rank": 1, "Session Return %": 1,
    "Relative Volume (RVOL EMA)": 1, "Relative Volume (RVOL Median)": 1, "Idiosyncratic RVOL": 1,
    "Jacoby Range Index": 1
  };
  var FMT_PCT2 = { "Jacoby Volume Profile Oscillator": 1 };
  var FMT_VOL = { "Volume (Vol)": 1, "21-Period EMA Volume": 1, "21-Period Median Volume": 1 };
  var FMT_INT = { "Notional Turnover ($M)": 1 };
  var FMT_SIGN = { "Session Return %": 1, "Idiosyncratic RVOL": 1, "Jacoby Range Index": 1, "Jacoby Volume Profile Oscillator": 1 };

  var rows = [];
  var columns = [];
  var guide = [];
  var guideByName = {};
  var sortKey = "Ticker";
  var sortAsc = true;
  var page = 1;
  var pageSize = 10;

  function fmtNum(v, dec) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Number(v).toFixed(dec);
  }

  function fmtCompact(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    var abs = Math.abs(v);
    if (abs >= 1e9) return (v / 1e9).toFixed(1) + "B";
    if (abs >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return (v / 1e3).toFixed(1) + "K";
    return String(Math.round(v));
  }

  function fmtDate(v) {
    if (!v) return "";
    return String(v).slice(0, 10);
  }

  function fmtCell(col, v) {
    if (FMT_DATE[col]) return fmtDate(v);
    if (FMT_PRICE[col]) return fmtNum(v, 2);
    if (FMT_PCT1[col]) return fmtNum(v, 1);
    if (FMT_PCT2[col]) return fmtNum(v, 2);
    if (FMT_VOL[col]) return fmtCompact(v);
    if (FMT_INT[col]) return fmtNum(v, 0);
    return v === null || v === undefined ? "—" : String(v);
  }

  function cellClass(col, v) {
    if (FMT_SIGN[col] && typeof v === "number" && !isNaN(v)) {
      return v > 0 ? "pos" : "neg";
    }
    return "";
  }

  function paintSort() {
    var thead = document.querySelector("#watchlist-table thead");
    if (!thead) return;
    thead.querySelectorAll("th").forEach(function (th) {
      th.classList.toggle("sorted", th.getAttribute("data-sort") === sortKey);
      th.classList.toggle("desc", th.getAttribute("data-sort") === sortKey && !sortAsc);
    });
  }

  function sortBy(key) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = true; }
    render();
    paintSort();
  }

  function buildHeader() {
    var tr = document.querySelector("#watchlist-table thead tr");
    tr.innerHTML = "";
    columns.forEach(function (col) {
      var th = document.createElement("th");
      th.setAttribute("data-sort", col.name);

      var label = document.createElement("span");
      label.className = "col-label";
      label.textContent = col.name;
      th.appendChild(label);

      var info = document.createElement("button");
      info.type = "button";
      info.className = "col-info";
      info.title = "What is " + col.name + "?";
      info.setAttribute("aria-label", "About " + col.name);
      info.textContent = "i";
      info.addEventListener("click", function (e) {
        e.stopPropagation();
        openGuideFor(col.name);
      });
      th.appendChild(info);

      th.addEventListener("click", function () { sortBy(col.name); });
      tr.appendChild(th);
    });
  }

  function updateScrollHint() {
    var table = document.getElementById("watchlist-table");
    var wrap = table ? table.closest(".table-wrap") : null;
    var hint = document.getElementById("watchlist-scroll-hint");
    if (!wrap) return;
    var canScroll = wrap.scrollWidth > wrap.clientWidth + 1;
    wrap.classList.toggle("can-scroll", canScroll);
    wrap.classList.toggle(
      "scrolled-right",
      canScroll && wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 1
    );
    if (hint) hint.hidden = !canScroll;
  }

  function updatePagination(pages, total) {
    var info = document.getElementById("page-info");
    var prev = document.getElementById("page-prev");
    var next = document.getElementById("page-next");
    var per = pageSize || total;
    if (info) {
      if (pages <= 1) {
        info.textContent = total ? "All " + total + " shown" : "";
      } else {
        var start = (page - 1) * per + 1;
        var end = Math.min(page * per, total);
        info.textContent = start + "–" + end + " of " + total;
      }
    }
    if (prev) prev.disabled = pages <= 1 || page <= 1;
    if (next) next.disabled = pages <= 1 || page >= pages;
  }

  function render() {
    var tbody = document.querySelector("#watchlist-table tbody");
    var count = document.getElementById("watchlist-count");
    if (!tbody) return;
    var q = (document.getElementById("filter-ticker").value || "").toLowerCase();

    var shown = rows.filter(function (r) {
      return !q || String(r.Ticker).toLowerCase().indexOf(q) !== -1;
    });

    shown.sort(function (a, b) {
      var av = a[sortKey];
      var bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      av = typeof av === "number" ? av : NaN;
      bv = typeof bv === "number" ? bv : NaN;
      if (isNaN(av)) return 1;
      if (isNaN(bv)) return -1;
      return sortAsc ? av - bv : bv - av;
    });

    var total = shown.length;
    var per = pageSize || total;
    var pages = Math.max(1, Math.ceil(total / per));
    if (page > pages) page = pages;
    var start = (page - 1) * per;
    var pageRows = shown.slice(start, start + per);

    tbody.innerHTML = "";
    pageRows.forEach(function (row) {
      var tr = document.createElement("tr");
      var html = "";
      columns.forEach(function (col) {
        if (col.name === "Ticker") {
          var sym = row.Ticker === null || row.Ticker === undefined ? "" : String(row.Ticker);
          html += "<td><a href='/stock.html?ticker=" + encodeURIComponent(sym) + "'>" + sym + "</a></td>";
          return;
        }
        var v = row[col.name];
        var cls = cellClass(col.name, v);
        html += "<td" + (cls ? " class='" + cls + "'" : "") + ">" + fmtCell(col.name, v) + "</td>";
      });
      tr.innerHTML = html;
      tbody.appendChild(tr);
    });
    count.textContent = total + " result" + (total === 1 ? "" : "s");
    updatePagination(pages, total);
    updateScrollHint();
  }

  /* ---- Column guide accordion ---- */
  function guideBlock(label, text) {
    var div = document.createElement("div");
    var h = document.createElement("div");
    h.className = "guide-label";
    h.textContent = label;
    div.appendChild(h);
    var p = document.createElement("div");
    p.textContent = text || "—";
    div.appendChild(p);
    return div;
  }

  function renderGuide() {
    var list = document.getElementById("guide-list");
    if (!list) return;
    list.innerHTML = "";
    guideByName = {};
    guide.forEach(function (entry) {
      var item = document.createElement("div");
      item.className = "guide-item";
      guideByName[entry.name] = item;

      var head = document.createElement("button");
      head.type = "button";
      head.className = "guide-item-head";
      var kind = document.createElement("span");
      kind.className = "kind " + entry.kind;
      kind.textContent = entry.kind;
      var title = document.createElement("span");
      title.textContent = entry.name;
      head.appendChild(kind);
      head.appendChild(title);
      head.addEventListener("click", function () { toggleGuideItem(item); });

      var body = document.createElement("div");
      body.className = "guide-item-body";
      body.appendChild(guideBlock("Formula", entry.formula));
      body.appendChild(guideBlock("Meaning", entry.meaning));
      if (entry.recompute) body.appendChild(guideBlock("Recompute from the watchlist", entry.recompute));

      item.appendChild(head);
      item.appendChild(body);
      list.appendChild(item);
    });
  }

  function showPanel() {
    var panel = document.getElementById("guide-panel");
    var btn = document.getElementById("btn-guide-toggle");
    if (!panel) return;
    panel.hidden = false;
    if (btn) btn.textContent = "Close Column Guide";
  }

  function toggleGuideItem(item) {
    var open = item.classList.contains("open");
    document.querySelectorAll(".guide-item.open").forEach(function (el) {
      el.classList.remove("open");
    });
    if (!open) item.classList.add("open");
    showPanel();
  }

  function openGuideFor(columnName) {
    if (!guideByName[columnName]) return;
    showPanel();
    document.querySelectorAll(".guide-item.open").forEach(function (el) {
      el.classList.remove("open");
    });
    var item = guideByName[columnName];
    item.classList.add("open");
    item.classList.remove("flash");
    void item.offsetWidth; /* restart the flash animation */
    item.classList.add("flash");
    item.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---- Load ---- */
  function loadGuide() {
    fetch(API_ROOT + "/api/watchlist/guide")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        guide = data.columns || [];
        renderGuide();
      })
      .catch(function () {
        var btn = document.getElementById("btn-guide-toggle");
        if (btn) btn.disabled = true;
      });
  }

  function load() {
    var dateEl = document.getElementById("watchlist-date");
    fetch(API_ROOT + "/api/watchlist")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        rows = data.items;
        columns = data.columns;
        if (dateEl) dateEl.textContent = "As of " + fmtDate(data.as_of) + " — 18 months of daily data.";
        var hint = document.getElementById("watchlist-scroll-hint");
        if (hint) hint.textContent = "Scroll right for all " + columns.length + " columns.";
        buildHeader();
        render();
        paintSort();
        updateScrollHint();
        loadGuide();
      })
      .catch(function (err) {
        var count = document.getElementById("watchlist-count");
        if (count) count.textContent = "Watchlist unavailable right now (" + err.message + ").";
      });
  }

  function init() {
    var table = document.getElementById("watchlist-table");
    if (!table) return;
    var filter = document.getElementById("filter-ticker");
    if (filter) filter.addEventListener("input", function () {
      page = 1;
      render();
    });
    var reset = document.getElementById("btn-reset");
    if (reset) reset.addEventListener("click", function () {
      filter.value = "";
      page = 1;
      render();
    });
    var toggle = document.getElementById("btn-guide-toggle");
    if (toggle) toggle.addEventListener("click", function () {
      var panel = document.getElementById("guide-panel");
      var willHide = !panel.hidden;
      panel.hidden = willHide;
      if (willHide) {
        document.querySelectorAll(".guide-item.open").forEach(function (el) {
          el.classList.remove("open");
        });
      }
      toggle.textContent = willHide ? "Column Guide" : "Close Column Guide";
    });
    var prev = document.getElementById("page-prev");
    var next = document.getElementById("page-next");
    if (prev) prev.addEventListener("click", function () {
      if (page > 1) { page--; render(); }
    });
    if (next) next.addEventListener("click", function () {
      page++;
      render();
    });
    var sizeSel = document.getElementById("page-size-select");
    if (sizeSel) sizeSel.addEventListener("change", function () {
      pageSize = Number(sizeSel.value) || 0;
      page = 1;
      render();
    });
    var wrap = table.closest(".table-wrap");
    if (wrap) {
      wrap.addEventListener("scroll", updateScrollHint);
      window.addEventListener("resize", updateScrollHint);
    }
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
