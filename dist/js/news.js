/* The ChasIX Stock News Ranking: fetches ranked news from the API and
   renders a sortable, filterable table. Column headers sort; hovering or
   clicking ⓘ/ⓐ opens that column's entry in the Column Guide. */
(function () {
  "use strict";

  var API_ROOT = window.API_ROOT || "https://api.thechasix.com";

  var articles = [];
  var filterTicker = "";
  var filterSentiment = "";
  var sortKey = "signal_strength";
  var sortAsc = false;
  var page = 1;
  var pageSize = 10;
  var guide = [];
  var guideByName = {};

  var GUIDE = [
    {
      name: "Catalyst Day",
      kind: "computed",
      formula: "The ticker actually moved intraday: RVOL >= 2.0 OR |Ch%| >= 2%. If blank, the stock was quiet that day — so the headlines are low-signal context, not a catalyst hunt.",
      meaning: "Only on days a stock spikes in volume/price is there a catalyst to find. Silence here = expect noise, not a miss.",
      recompute: "catalyst = (rvol >= 2.0) || (abs(exp(log_return) - 1) >= 0.02).",
    },
    {
      name: "Date",
      kind: "raw",
      formula: "Publication timestamp as returned by the news API.",
      meaning: "Sorts by recency of the headline.",
    },
    {
      name: "Ticker",
      kind: "raw",
      formula: "The watchlist symbol the article was tagged for (AV ticker_sentiment).",
      meaning: "Click to open the stock detail page for that symbol.",
    },
    {
      name: "Headline",
      kind: "raw",
      formula: "Article title from the source feed.",
      meaning: "Click to open the full article in a new tab.",
    },
    {
      name: "Source",
      kind: "raw",
      formula: "News outlet that published the article.",
      meaning: "Identifies the reporting venue.",
    },
    {
      name: "AV",
      kind: "computed",
      formula: "Alpha Vantage native sentiment: overall_sentiment_score in [-1, +1], bucketed into labels from Bearish to Bullish.",
      meaning: "Independent NLP sentiment — cross-checks our VADER label.",
      recompute: "From AV's overall_sentiment_score via their label thresholds.",
    },
    {
      name: "Sentiment",
      kind: "computed",
      formula: "VADER compound score of 'title + summary'. Label: >= +0.33 positive, <= -0.33 negative, else neutral.",
      meaning: "Lexical tone of the article. Positive = bullish lean, negative = bearish lean.",
      recompute: "vader_compound >= 0.33 counts as positive; <= -0.33 counts as negative.",
    },
    {
      name: "Signal",
      kind: "computed",
      formula: "Composite strength = sentiment, intraday volume/price at the nearest inflection, and source authority — weighted and gated by temporal recency to the volume spike. Falls back to VADER + RVOL + |Ch%| when no intraday inflection is detected.",
      meaning: "Ranks the day's headlines; higher = stronger news-to-price alignment and closer to the volume spike.",
      recompute: "signal_strength = core * (0.35 + 0.65*recency); core = 0.35*sentiment + 0.20*vol_at_inflection + 0.10*price_at_inflection + 0.10*source_weight.",
    },
    {
      name: "Inflect",
      kind: "computed",
      formula: "Nearest detected intraday volume inflection (9:30–16:00 ET). An inflection = bar volume >= 3.0x the rolling 20-bar SMA. Blank when the day had no qualifying spike (fallback ranking used).",
      meaning: "The spike this headline is scored against. Articles before the spike decay slower (potential trigger); after it decay faster (echo).",
      recompute: "Detector: rolling SMA20(volume), threshold >= INFLECTION_VOL_RATIO_THRESHOLD (3.0).",
    },
    {
      name: "Recency",
      kind: "computed",
      formula: "exp(-minutes / half_life) to the nearest inflection, in 0..1. Pre-market news uses a 45-min half-life; before-spike articles 30 min; after-spike 15 min. Post-market news is scored against the next session's opening spike.",
      meaning: "Gates the composite strength: headlines far from any spike are de-weighted rather than boosted. 1.0 = at the spike.",
      recompute: "recency = exp(-min_delta / half_life), half-life by causality direction (asymmetric).",
    },
    {
      name: "Ch %",
      kind: "computed",
      formula: "Percent price change over the baseline window = (e^log_return - 1) * 100, log_return = ln(P_target / P_base); P_base = prior-day close, P_target = latest close.",
      meaning: "Negative = price fell from the prior close; positive = rose.",
      recompute: "log_return = Math.log(target_price / base_price); Ch% = (Math.exp(log_return) - 1) * 100.",
    },
    {
      name: "Price",
      kind: "raw",
      formula: "Latest close price (target_price from the quote feed).",
      meaning: "Reference price for the day's move.",
    },
    {
      name: "RVOL",
      kind: "computed",
      formula: "Relative Volume = today's volume / 20-day average volume.",
      meaning: "> 1.0 = unusually heavy trading (heightened attention).",
      recompute: "rvol = volume / SMA20(volume).",
    },
    {
      name: "Volume (M)",
      kind: "raw",
      formula: "Shares traded on the latest day (from the quote feed), in millions.",
      meaning: "Magnitude of the day's trading activity.",
    },
  ];

  function fmtNum(v, dec) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Number(v).toFixed(dec);
  }

  function fmtVolume(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return (Number(v) / 1e6).toFixed(1);
  }

  function fmtDate(v) {
    if (!v) return "";
    return String(v).slice(0, 10);
  }

  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sentimentClass(label) {
    return label === "positive" ? "pos" : label === "negative" ? "neg" : "";
  }

  function avSentimentClass(label) {
    var l = String(label).toLowerCase();
    if (l.indexOf("bullish") !== -1) return "pos";
    if (l.indexOf("bearish") !== -1) return "neg";
    return "";
  }

  function guideRef(columnName) {
    return '<a href="#" class="desc-link" data-guide="' + esc(columnName) + '" title="How this column is computed">ⓘ</a>';
  }

  function render() {
    var tbody = document.querySelector("#news-table tbody");
    var status = document.getElementById("news-status");
    var count = document.getElementById("news-count");
    if (!tbody) return;

    var needle = filterTicker.toLowerCase();
    var rows = articles.filter(function (a) {
      if (filterTicker && a.ticker.toLowerCase().indexOf(needle) === -1) return false;
      if (filterSentiment && a.sentiment !== filterSentiment) return false;
      return true;
    });

    rows.sort(function (a, b) {
      var av = a[sortKey];
      var bv = b[sortKey];
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      av = av === null || av === undefined ? -Infinity : av;
      bv = bv === null || bv === undefined ? -Infinity : bv;
      return sortAsc ? av - bv : bv - av;
    });

    if (!articles.length) {
      status.textContent = "No news indexed yet — the daily refresh pipeline has not populated the database.";
    } else {
      status.textContent = rows.length + " of " + articles.length + " ranked headlines.";
    }
    if (count) count.textContent = rows.length + " rows.";

    var total = rows.length;
    var per = pageSize || total;
    var pages = Math.max(1, Math.ceil(total / per));
    if (page > pages) page = pages;
    var start = (page - 1) * per;
    var pageRows = rows.slice(start, start + per);

    tbody.innerHTML = "";
    pageRows.forEach(function (a) {
      var tr = document.createElement("tr");
      var pct = a.log_return !== null && a.log_return !== undefined
        ? (Math.exp(a.log_return) - 1) * 100
        : null;
      var lrClass = pct > 0 ? "pos" : pct < 0 ? "neg" : "";
      var close = a.close !== null && a.close !== undefined ? fmtNum(a.close, 2) : "—";
      var inflect = a.nearest_inflection_at ? String(a.nearest_inflection_at).slice(0, 16).replace("T", " ") : "—";

      tr.innerHTML =
        "<td>" + fmtDate(a.published_at) + "</td>" +
        "<td><a href='/stock.html?ticker=" + esc(a.ticker) + "'>" + esc(a.ticker) + "</a></td>" +
        "<td>" + (a.catalyst ? "<span class='cat-badge' title='Ticker moved intraday (RVOL ≥ 2 or |Ch%| ≥ 2). Catalyst likely.'>&#9679;</span>" : "") + "</td>" +
        "<td class='left'>" +
          (a.url ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title) + "</a>" : esc(a.title)) +
        "</td>" +
        "<td>" + esc(a.source) + "</td>" +
        "<td class='" + avSentimentClass(a.av_sentiment_label) + "'>" + esc(a.av_sentiment_label) + "</td>" +
        "<td class='" + sentimentClass(a.sentiment) + "'>" + esc(a.sentiment) + "</td>" +
        "<td>" + fmtNum(a.signal_strength, 2) + "</td>" +
        "<td>" + esc(inflect) + "</td>" +
        "<td>" + fmtNum(a.recency, 2) + "</td>" +
        "<td class='" + lrClass + "'>" + fmtNum(pct, 1) + "%</td>" +
        "<td>" + close + "</td>" +
        "<td>" + fmtNum(a.rvol, 1) + "</td>" +
        "<td>" + fmtVolume(a.volume) + "</td>";
      tbody.appendChild(tr);
    });

    if (!rows.length && articles.length) {
      tbody.innerHTML = "<tr><td colspan='14' class='muted'>No headlines match the current filters.</td></tr>";
    }

    updatePagination(pages, total);
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
      if (entry.recompute) body.appendChild(guideBlock("Derivation", entry.recompute));

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
    item.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  var topN = 0;

  function load() {
    var status = document.getElementById("news-status");
    var q = "limit=2000";
    if (topN > 0) q += "&top_n_per_ticker=" + topN;
    fetch(API_ROOT + "/api/news?" + q)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        articles = data.items || [];
        render();
      })
      .catch(function (err) {
        if (status) status.textContent = "News unavailable right now (" + err.message + ").";
        var tbody = document.querySelector("#news-table tbody");
        if (tbody) tbody.innerHTML = "<tr><td colspan='14' class='muted'>Could not load news.</td></tr>";
      });
  }

  function init() {
    var tickerInput = document.getElementById("filter-ticker");
    var sentiment = document.getElementById("filter-sentiment");
    var reset = document.getElementById("btn-reset");

    guide = GUIDE;
    renderGuide();

    if (tickerInput) tickerInput.addEventListener("input", function () {
      filterTicker = tickerInput.value.trim();
      page = 1;
      render();
    });
    if (sentiment) sentiment.addEventListener("change", function () {
      filterSentiment = sentiment.value;
      page = 1;
      render();
    });
    if (reset) reset.addEventListener("click", function () {
      if (tickerInput) tickerInput.value = "";
      if (sentiment) sentiment.value = "";
      filterTicker = "";
      filterSentiment = "";
      page = 1;
      render();
    });

    var table = document.getElementById("news-table");
    if (table) {
      table.querySelectorAll("th[data-sort]").forEach(function (th) {
        th.addEventListener("click", function () {
          var key = th.getAttribute("data-sort");
          if (sortKey === key) sortAsc = !sortAsc;
          else { sortKey = key; sortAsc = false; }
          page = 1;
          table.querySelectorAll("th.sorted").forEach(function (t2) { t2.classList.remove("sorted", "desc"); });
          th.classList.add("sorted");
          if (sortAsc) th.classList.add("desc");
          render();
        });
      });
      table.addEventListener("click", function (e) {
        var t = e.target.closest("[data-guide]");
        if (t) { e.preventDefault(); openGuideFor(t.getAttribute("data-guide")); }
      });
    }

    var toggle = document.getElementById("btn-guide-toggle");
    var topnBtn = document.getElementById("btn-topn");
    if (topnBtn) topnBtn.addEventListener("click", function () {
      topN = topN === 0 ? 3 : 0;
      topnBtn.textContent = "Top 3 / ticker: " + (topN === 0 ? "OFF" : "ON");
      page = 1;
      load();
    });
    if (toggle) toggle.addEventListener("click", function () {
      var panel = document.getElementById("guide-panel");
      if (panel.hidden) {
        panel.hidden = false;
        toggle.textContent = "Close Column Guide";
      } else {
        panel.hidden = true;
        toggle.textContent = "Column Guide";
      }
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
  }

  init();
  load();
})();