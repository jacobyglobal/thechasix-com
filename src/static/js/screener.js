(function () {
  "use strict";

  var API_ROOT = window.API_ROOT || "https://api.thechasix.com";

  var screenerRows = [];
  var screenerSort = { key: "rank", asc: true };
  var screenerMode = "high";
  var screenerType = "etf";

  function fmtPct(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return v.toFixed(2) + "%";
  }

  function fmtNum(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Number(v).toFixed(2);
  }

  function fmtDate(v) {
    if (!v) return "";
    return String(v).slice(0, 10);
  }

  function heatColor(d) {
    if (d === null || d === undefined || isNaN(d)) return "transparent";
    var t = Math.max(0, Math.min(1, (10 - d) / 9));
    var r = Math.round(25 + (225 - 25) * t);
    var g = Math.round(25 + (29 - 25) * t);
    var b = Math.round(29 + (46 - 29) * t);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function durationCell(row, d, mode) {
    var fromHigh = mode !== "low";
    var dec = row[fromHigh ? "high_decile_" + d : "low_decile_" + d];
    var pct = row[fromHigh ? "off_high_pct_" + d : "off_low_pct_" + d];
    var price = row[fromHigh ? "high_" + d : "low_" + d];
    var bg = heatColor(dec);
    return "<td style='background:" + bg + ";'>" +
      "<div class='cell-pct'>" + fmtPct(pct) + "</div>" +
      "<div class='cell-high'>" + fmtNum(price) + "</div></td>";
  }

  function populateSectors(items) {
    var select = document.getElementById("filter-sector");
    if (!select) return;
    var seen = {};
    items.forEach(function (row) { seen[row.sector] = true; });
    Object.keys(seen).sort().forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      select.appendChild(opt);
    });
  }

  function readTypeFromURL() {
    var params = new URLSearchParams(window.location.search);
    return params.get("type") || "etf";
  }

  function updateTypeToggleUI() {
    document.querySelectorAll("#type-toggle .seg-btn").forEach(function (btn) {
      var active = btn.getAttribute("data-type") === screenerType;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderScreener() {
    var tbody = document.querySelector("#screener-table tbody");
    var count = document.getElementById("screener-count");
    if (!tbody) return;
    var tickerFilter = (document.getElementById("filter-ticker").value || "").toLowerCase();
    var sector = document.getElementById("filter-sector").value;
    var decile = document.getElementById("filter-decile").value;
    var decileCol = screenerMode === "low" ? "low_decile_52w" : "high_decile_52w";

    var rows = screenerRows.filter(function (row) {
      if (tickerFilter && row.ticker.toLowerCase().indexOf(tickerFilter) === -1) return false;
      if (sector && row.sector !== sector) return false;
      if (decile && row[decileCol] !== Number(decile)) return false;
      return true;
    });

    rows.sort(function (a, b) {
      var av = a[screenerSort.key];
      var bv = b[screenerSort.key];
      if (typeof av === "string") return screenerSort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
      return screenerSort.asc ? av - bv : bv - av;
    });

    tbody.innerHTML = "";
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + row.rank + "</td>" +
        "<td><a href='/chart/" + row.ticker + "'>" + row.ticker + "</a></td>" +
        "<td>" + row.sector + "</td>" +
        "<td>" + fmtNum(row.close) + "</td>" +
        durationCell(row, "4w", screenerMode) +
        durationCell(row, "12w", screenerMode) +
        durationCell(row, "26w", screenerMode) +
        durationCell(row, "52w", screenerMode) +
        "<td>" + fmtNum(row.composite_score) + "</td>";
      tbody.appendChild(tr);
    });
    if (count) count.textContent = rows.length + " results";
  }

  function setScreenerMode(mode) {
    screenerMode = mode === "low" ? "low" : "high";
    var fromHigh = screenerMode === "high";

    document.querySelectorAll(".mode-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === screenerMode);
    });

    var decileTop = document.querySelector("#filter-decile option[value='10']");
    if (decileTop) decileTop.textContent = "10 — " + (fromHigh ? "strongest" : "strongest (farthest off low)");

    var note = document.getElementById("screener-note");
    if (note) {
      note.textContent = fromHigh
        ? "Duration cells show % off period high (ln) over the period high price; color = strength (black = nearest high, red = deepest drawdown)."
        : "Duration cells show % off period low (ln) over the period low price; color = strength (black = farthest off low, red = sitting at low).";
    }

    var table = document.getElementById("screener-table");
    if (table) {
      table.querySelectorAll("th[data-sort]").forEach(function (th) {
        var key = th.getAttribute("data-sort");
        if (key.indexOf("off_high_pct_") === 0) {
          th.setAttribute("data-sort", "off_low_pct_" + key.slice("off_high_pct_".length));
        } else if (key.indexOf("off_low_pct_") === 0) {
          th.setAttribute("data-sort", "off_high_pct_" + key.slice("off_low_pct_".length));
        }
      });
    }
    if (screenerSort.key.indexOf("off_high_pct_") === 0) {
      screenerSort.key = "off_low_pct_" + screenerSort.key.slice("off_high_pct_".length);
    } else if (screenerSort.key.indexOf("off_low_pct_") === 0) {
      screenerSort.key = "off_high_pct_" + screenerSort.key.slice("off_low_pct_".length);
    }
    renderScreener();
  }

  function loadScreener() {
    var count = document.getElementById("screener-count");
    var dateEl = document.getElementById("screener-date");
    var params = new URLSearchParams(window.location.search);
    var typeParam = params.get("type") || "etf";
    screenerType = typeParam;

    var url = API_ROOT + "/api/stocks?limit=200";
    if (typeParam && typeParam !== "all") {
      url += "&type=" + typeParam;
    }

    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        screenerRows = data.items;
        if (dateEl) dateEl.textContent = "As of " + fmtDate(data.as_of);
        populateSectors(screenerRows);
        updateTypeToggleUI();
        renderScreener();
      })
      .catch(function (err) {
        if (count) count.textContent = "Screener unavailable right now (" + err.message + ").";
      });
  }

  function init() {
    var table = document.getElementById("screener-table");
    if (!table) return;
    loadScreener();

    ["filter-ticker", "filter-sector", "filter-decile"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("input", renderScreener);
      if (el) el.addEventListener("change", renderScreener);
    });

    var reset = document.getElementById("btn-reset");
    if (reset) reset.addEventListener("click", function () {
      document.getElementById("filter-ticker").value = "";
      document.getElementById("filter-sector").value = "";
      document.getElementById("filter-decile").value = "";
      renderScreener();
    });

    document.querySelectorAll(".mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setScreenerMode(btn.getAttribute("data-mode"));
      });
    });

    document.querySelectorAll("#type-toggle .seg-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var type = btn.getAttribute("data-type");
        var url = "/screener";
        if (type !== "all") { url += "?type=" + type; }
        window.location.href = url;
      });
    });

    table.querySelectorAll("th[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-sort");
        if (screenerSort.key === key) screenerSort.asc = !screenerSort.asc;
        else screenerSort = { key: key, asc: true };
        renderScreener();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
