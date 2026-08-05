/* The ChasIX Stock Watchlist: fetches the committed WatchList output from the
   API and renders a sortable/searchable table with a column-guide accordion. */
(function () {
  "use strict";

  var API_ROOT = window.API_ROOT || "https://api.thechasix.com";

  /* Per-column display formatting (column names are the CSV headers). */
  var FMT_DATE = { Date: 1 };
  var FMT_PRICE = {
    Open: 1, High: 1, Low: 1, Close: 1, "OHLC / 4": 1, "True Range": 1,
    "Average True Range (ATR)": 1, "52-Wk High": 1, "52-Wk Low": 1, "52-Wk Range": 1
  };
  var FMT_PCT1 = {
    "ATR as % Price": 1, "DeMark High Low Rank": 1, "Close vs Open %": 1,
    "Vol % of Vol EMA 21": 1, "Vol % of Vol Median 21": 1, "Relative Vol vs QQQ Market": 1
  };
  var FMT_VOL = { "Volume (Vol)": 1, "Vol EMA 21": 1, "Vol Median 21": 1 };
  var FMT_INT = { "Notional Value $M": 1 };
  var FMT_SIGN = { "Close vs Open %": 1, "Relative Vol vs QQQ Market": 1 };

  var rows = [];
  var columns = [];
  var guide = [];
  var guideByName = {};
  var sortKey = "Ticker";
  var sortAsc = true;

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

  function buildHeader() {
    var tr = document.querySelector("#watchlist-table thead tr");
    tr.innerHTML = "";
    columns.forEach(function (col) {
      var th = document.createElement("th");
      th.setAttribute("data-sort", col.name);
      th.textContent = col.name;
      th.addEventListener("click", function () {
        if (sortKey === col.name) sortAsc = !sortAsc;
        else { sortKey = col.name; sortAsc = true; }
        render();
        paintSort();
        openGuideFor(col.name);
      });
      tr.appendChild(th);
    });
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

    tbody.innerHTML = "";
    shown.forEach(function (row) {
      var tr = document.createElement("tr");
      var html = "";
      columns.forEach(function (col) {
        var v = row[col.name];
        var cls = cellClass(col.name, v);
        html += "<td" + (cls ? " class='" + cls + "'" : "") + ">" + fmtCell(col.name, v) + "</td>";
      });
      tr.innerHTML = html;
      tbody.appendChild(tr);
    });
    count.textContent = shown.length + " of " + rows.length + " results";
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
        buildHeader();
        render();
        paintSort();
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
    if (filter) filter.addEventListener("input", render);
    var reset = document.getElementById("btn-reset");
    if (reset) reset.addEventListener("click", function () {
      filter.value = "";
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
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
