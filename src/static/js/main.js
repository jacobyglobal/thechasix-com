/* The ChasIX frontend app: fetches JSON from the Render API and renders it. */
(function () {
  "use strict";

  var API_ROOT = window.API_ROOT || "https://thechasix-com.onrender.com";

  function fmtPct(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return v.toFixed(1) + "%";
  }

  function fmtNum(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  function decileClass(d) {
    if (d === null || d === undefined || isNaN(d)) return "decile-weak";
    if (d >= 8) return "decile-strong";
    if (d >= 5) return "decile-mid";
    return "decile-weak";
  }

  function decilePill(d) {
    if (d === null || d === undefined || isNaN(d)) return "<span class='decile-pill decile-weak'>—</span>";
    return "<span class='decile-pill " + decileClass(d) + "'>" + d + "</span>";
  }

  /* ---- Landing: market breadth ---- */
  function loadBreadth() {
    var grid = document.querySelector(".breadth-grid");
    var label = document.querySelector(".breadth-card .muted");
    if (!grid) return;
    fetch(API_ROOT + "/api/metrics/breadth")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        label.textContent = "Percent of tracked ETFs at market high by horizon.";
        grid.innerHTML = "";
        data.items.forEach(function (row) {
          var tile = document.createElement("div");
          tile.className = "breadth-tile";
          tile.innerHTML =
            "<div class='dur'>" + row.duration + "</div>" +
            "<div class='num'>" + fmtPct(row.avg_off_high_pct) + "</div>" +
            "<div class='sub'>avg off high</div>" +
            "<div class='sub'>at high: " + row.pct_at_high + "%</div>";
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
        label.textContent = "Top 10 composite market profiles.";
        tbody.innerHTML = "";
        data.items.forEach(function (row) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + row.rank + "</td>" +
            "<td><a href='/stock.html?ticker=" + row.ticker + "'>" + row.ticker + "</a></td>" +
            "<td>" + row.sector + "</td>" +
            "<td>" + decilePill(row.high_decile_4w) + "</td>" +
            "<td>" + decilePill(row.high_decile_12w) + "</td>" +
            "<td>" + decilePill(row.high_decile_26w) + "</td>" +
            "<td>" + decilePill(row.high_decile_52w) + "</td>" +
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
        "<td>" + decilePill(row.high_decile_4w) + "</td>" +
        "<td>" + decilePill(row.high_decile_12w) + "</td>" +
        "<td>" + decilePill(row.high_decile_26w) + "</td>" +
        "<td>" + decilePill(row.high_decile_52w) + "</td>" +
        "<td>" + fmtNum(row.composite_score) + "</td>";
      tbody.appendChild(tr);
    });
    count.textContent = rows.length + " results";
  }

  function loadScreener() {
    var count = document.getElementById("screener-count");
    fetch(API_ROOT + "/api/stocks?limit=200")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        screenerRows = data.items;
        populateSectors(screenerRows);
        renderScreener();
      })
      .catch(function (err) {
        if (count) count.textContent = "Screener unavailable right now (" + err.message + ").";
      });
  }

  /* ---- Stock detail ---- */
  function loadDetail(ticker) {
    var errBox = document.getElementById("detail-error");
    var apiRoot = API_ROOT;

    fetch(apiRoot + "/api/stocks/" + encodeURIComponent(ticker))
      .then(function (r) {
        if (r.status === 404) throw new Error("Ticker not found");
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (profile) {
        document.getElementById("detail-ticker").textContent = profile.ticker;
        document.getElementById("detail-sector").textContent = profile.sector;
        var tbody = document.querySelector("#profile-table tbody");
        tbody.innerHTML = "";
        ["4w", "12w", "26w", "52w"].forEach(function (d) {
          var row = profile.durations[d];
          if (!row) return;
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + d + "</td>" +
            "<td>" + row.days + "</td>" +
            "<td>" + fmtNum(row.recent_close) + "</td>" +
            "<td>" + fmtPct(row.off_high_pct) + "</td>" +
            "<td>" + fmtPct(row.off_low_pct) + "</td>" +
            "<td>" + decilePill(row.off_high_decile) + "</td>" +
            "<td>" + (row.at_high ? "<strong style='color:var(--accent)'>Yes</strong>" : "No") + "</td>";
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        errBox.hidden = false;
        errBox.textContent = "Could not load profile for " + ticker + ": " + err.message;
      });

    fetch(apiRoot + "/api/stocks/" + encodeURIComponent(ticker) + "/chart?limit=760")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var items = data.items || [];
        var labels = items.map(function (x) { return String(x.date || x.datetime || ""); });
        var close = items.map(function (x) { return x.close !== undefined ? x.close : x.Close; });
        drawPriceChart(labels, close, ticker);
      })
      .catch(function (err) {
        var chart = document.getElementById("price-chart");
        if (chart) {
          chart.getContext("2d").clearRect(0, 0, chart.width, chart.height);
        }
      });

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
            "<span class='meta'> — " + fmtNum(item.similarity_score) + " similarity</span>";
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
    var ctx = canvas.getContext("2d");
    var gradient = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight);
    gradient.addColorStop(0, "rgba(225,29,46,0.35)");
    gradient.addColorStop(1, "rgba(225,29,46,0)");
    new Chart(ctx, {
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
        plugins: { legend: { labels: { color: "#9a9aa5" } } },
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
})();
