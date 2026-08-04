/* The ChasIX frontend app: fetches JSON from the Render API and renders it. */
(function () {
  "use strict";

  var API_ROOT = window.API_ROOT || "https://thechasix-com.onrender.com";

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

  function fmtAxisDate(v) {
    /* Normalize an ISO datetime (2026-07-30T00:00:00) to MM-DD-YYYY. */
    if (!v) return "";
    var s = String(v);
    var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    return m[2] + "-" + m[3] + "-" + m[1];
  }

  /* Heatmap: decile 10 (closest to high) = black, decile 1 (farthest) = accent red. */
  function heatColor(d) {
    if (d === null || d === undefined || isNaN(d)) return "transparent";
    var t = Math.max(0, Math.min(1, (10 - d) / 9));
    var r = Math.round(25 + (225 - 25) * t);
    var g = Math.round(25 + (29 - 25) * t);
    var b = Math.round(29 + (46 - 29) * t);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  /* One duration cell: off-high ln-distance on top, period high price below. */
  function durationCell(row, d) {
    var dec = row["high_decile_" + d];
    var pct = row["off_high_pct_" + d];
    var high = row["high_" + d];
    var bg = heatColor(dec);
    return "<td style='background:" + bg + ";'>" +
      "<div class='cell-pct'>" + fmtPct(pct) + "</div>" +
      "<div class='cell-high'>" + fmtNum(high) + "</div></td>";
  }

  /* ---- Landing: market breadth ---- */
  function loadBreadth() {
    var grid = document.querySelector(".breadth-grid");
    var label = document.querySelector(".breadth-card .muted");
    if (!grid) return;
    fetch(API_ROOT + "/api/metrics/breadth")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        label.textContent = "Average distance from period highs by horizon.";
        grid.innerHTML = "";
        data.items.forEach(function (row) {
          var tile = document.createElement("div");
          tile.className = "breadth-tile";
          tile.innerHTML =
            "<div class='dur'>" + row.duration + "</div>" +
            "<div class='num'>" + fmtPct(row.avg_off_high_pct) + "</div>" +
            "<div class='sub'>avg off high</div>";
          grid.appendChild(tile);
        });
      })
      .catch(function (err) {
        label.textContent = "Breadth unavailable right now (" + err.message + ").";
      });
  }

  /* ---- Landing: top leaderboard rows ---- */
  function loadLeaderboard() {
    var tbody = document.querySelector("[data-leaderboard] tbody");
    var label = document.querySelector(".leaderboard-card .muted");
    if (!tbody) return;
    fetch(API_ROOT + "/api/stocks?limit=10")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        label.textContent = "As of " + fmtDate(data.as_of) + " — top 10 composite market profiles.";
        tbody.innerHTML = "";
        data.items.forEach(function (row) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + row.rank + "</td>" +
            "<td><a href='/stock.html?ticker=" + row.ticker + "'>" + row.ticker + "</a></td>" +
            "<td>" + row.sector + "</td>" +
            "<td>" + fmtNum(row.close) + "</td>" +
            durationCell(row, "4w") +
            durationCell(row, "12w") +
            durationCell(row, "26w") +
            durationCell(row, "52w") +
            "<td>" + fmtNum(row.composite_score) + "</td>";
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        label.textContent = "Leaderboard unavailable right now (" + err.message + ").";
      });
  }

  /* ---- Screener: load, filter, sort ---- */
  var screenerRows = [];
  var screenerSort = { key: "rank", asc: true };

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

  function renderScreener() {
    var tbody = document.querySelector("#screener-table tbody");
    var count = document.getElementById("screener-count");
    if (!tbody) return;
    var tickerFilter = (document.getElementById("filter-ticker").value || "").toLowerCase();
    var sector = document.getElementById("filter-sector").value;
    var decile = document.getElementById("filter-decile").value;

    var rows = screenerRows.filter(function (row) {
      if (tickerFilter && row.ticker.toLowerCase().indexOf(tickerFilter) === -1) return false;
      if (sector && row.sector !== sector) return false;
      if (decile && row.high_decile_52w !== Number(decile)) return false;
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
        "<td><a href='/stock.html?ticker=" + row.ticker + "'>" + row.ticker + "</a></td>" +
        "<td>" + row.sector + "</td>" +
        "<td>" + fmtNum(row.close) + "</td>" +
        durationCell(row, "4w") +
        durationCell(row, "12w") +
        durationCell(row, "26w") +
        durationCell(row, "52w") +
        "<td>" + fmtNum(row.composite_score) + "</td>";
      tbody.appendChild(tr);
    });
    count.textContent = rows.length + " results";
  }

  function loadScreener() {
    var count = document.getElementById("screener-count");
    var dateEl = document.getElementById("screener-date");
    fetch(API_ROOT + "/api/stocks?limit=200")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        screenerRows = data.items;
        if (dateEl) dateEl.textContent = "As of " + fmtDate(data.as_of);
        populateSectors(screenerRows);
        renderScreener();
      })
      .catch(function (err) {
        if (count) count.textContent = "Screener unavailable right now (" + err.message + ").";
      });
  }

  /* ---- Stock detail ---- */
  var priceChart = null;
  var chartTicker = null;

  var CHART_PERIODS = [
    { label: "10Y", days: 2520 },
    { label: "5Y", days: 1260 },
    { label: "2Y", days: 504 },
    { label: "1Y", days: 252 },
    { label: "6M", days: 126 },
    { label: "1M", days: 21 },
  ];

  function loadPriceChart(ticker, limit) {
    var canvas = document.getElementById("price-chart");
    if (!canvas) return;
    var apiRoot = API_ROOT;
    fetch(apiRoot + "/api/stocks/" + encodeURIComponent(ticker) + "/chart?limit=" + limit)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var items = data.items || [];
        var labels = items.map(function (x) { return fmtAxisDate(x.date || x.datetime || ""); });
        var close = items.map(function (x) { return x.close !== undefined ? x.close : x.Close; });
        drawPriceChart(labels, close, ticker);
      })
      .catch(function (err) {
        var chart = document.getElementById("price-chart");
        if (chart) {
          chart.getContext("2d").clearRect(0, 0, chart.width, chart.height);
        }
      });
  }

  function setupChartPeriods(ticker) {
    var bar = document.getElementById("chart-periods");
    if (!bar) return;
    bar.innerHTML = "";
    CHART_PERIODS.forEach(function (period) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "period-btn" + (period.days === 2520 ? " active" : "");
      btn.textContent = period.label;
      btn.addEventListener("click", function () {
        bar.querySelectorAll(".period-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        loadPriceChart(ticker, period.days);
      });
      bar.appendChild(btn);
    });
  }

  function loadDetail(ticker) {
    var errBox = document.getElementById("detail-error");
    var apiRoot = API_ROOT;
    chartTicker = ticker;

    fetch(apiRoot + "/api/stocks/" + encodeURIComponent(ticker))
      .then(function (r) {
        if (r.status === 404) throw new Error("Ticker not found");
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (profile) {
        document.getElementById("detail-ticker").textContent = profile.ticker;
        document.getElementById("detail-sector").textContent =
          profile.sector + " · close " + fmtNum(profile.close) + " · as of " + fmtDate(profile.date);
        var tbody = document.querySelector("#profile-table tbody");
        tbody.innerHTML = "";
        ["4w", "12w", "26w", "52w"].forEach(function (d) {
          var row = profile.durations[d];
          if (!row) return;
          var bg = heatColor(row.off_high_decile);
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + d + "</td>" +
            "<td>" + row.days + "</td>" +
            "<td>" + fmtNum(row.period_high_value) + "</td>" +
            "<td style='background:" + bg + ";'>" + fmtPct(row.off_high_pct) + "</td>" +
            "<td>" + fmtPct(row.off_low_pct) + "</td>";
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        errBox.hidden = false;
        errBox.textContent = "Could not load profile for " + ticker + ": " + err.message;
      });

    setupChartPeriods(ticker);
    loadPriceChart(ticker, 2520);

    fetch(apiRoot + "/api/stocks/" + encodeURIComponent(ticker) + "/similar")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var list = document.getElementById("similar-list");
        list.innerHTML = "";
        (data.similar || data.items || []).forEach(function (item) {
          var li = document.createElement("li");
          var t = item.ticker || item.symbol || "";
          li.innerHTML =
            "<a href='/stock.html?ticker=" + t + "'>" + t + "</a>" +
            "<span class='meta'> — relationship " + item.rank + "/10</span>";
          list.appendChild(li);
        });
      })
      .catch(function () {
        var list = document.getElementById("similar-list");
        if (list) list.innerHTML = "<li class='muted'>Similar assets unavailable.</li>";
      });
  }

  function drawPriceChart(labels, close, ticker) {
    var canvas = document.getElementById("price-chart");
    if (!canvas || !window.Chart) return;
    if (priceChart) priceChart.destroy();
    var ctx = canvas.getContext("2d");
    var gradient = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight);
    gradient.addColorStop(0, "rgba(225,29,46,0.35)");
    gradient.addColorStop(1, "rgba(225,29,46,0)");
    priceChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: ticker + " Close",
          data: close,
          borderColor: "#e11d2e",
          backgroundColor: gradient,
          borderWidth: 1.6,
          fill: true,
          pointRadius: 0,
          tension: 0.1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#9a9aa5" } },
          tooltip: {
            callbacks: {
              title: function (items) {
                return fmtAxisDate(items[0].label);
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: "#9a9aa5", maxTicksLimit: 10 }, grid: { color: "#1f1f24" } },
          y: { ticks: { color: "#9a9aa5" }, grid: { color: "#1f1f24" } }
        }
      }
    });
  }

  function init() {
    if (document.querySelector("[data-breadth]")) loadBreadth();
    if (document.querySelector("[data-leaderboard]")) loadLeaderboard();

    var table = document.getElementById("screener-table");
    if (table) {
      loadScreener();
      ["filter-ticker", "filter-sector", "filter-decile"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener("input", renderScreener);
      });
      var reset = document.getElementById("btn-reset");
      if (reset) reset.addEventListener("click", function () {
        document.getElementById("filter-ticker").value = "";
        document.getElementById("filter-sector").value = "";
        document.getElementById("filter-decile").value = "";
        renderScreener();
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.loadDetail = loadDetail;
})();
