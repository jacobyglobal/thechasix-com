/* The ChasIX Stock News Ranking: fetches ranked news from the API and
   renders a filterable card list (ticker, headline, source, sentiment,
   price signals). */
(function () {
  "use strict";

  var API_ROOT = window.API_ROOT || "https://api.thechasix.com";

  var articles = [];
  var filterTicker = "";
  var filterSentiment = "";

  function fmtNum(v, dec) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Number(v).toFixed(dec);
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

  function render() {
    var list = document.getElementById("news-list");
    var status = document.getElementById("news-status");
    if (!list) return;

    var needle = filterTicker.toLowerCase();
    var rows = articles.filter(function (a) {
      if (filterTicker && a.ticker.toLowerCase().indexOf(needle) === -1) return false;
      if (filterSentiment && a.sentiment !== filterSentiment) return false;
      return true;
    });

    if (!articles.length) {
      status.textContent = "No news indexed yet — the daily refresh pipeline has not populated the database.";
    } else {
      status.textContent = rows.length + " of " + articles.length + " ranked headlines.";
    }

    list.innerHTML = "";
    rows.forEach(function (a) {
      var card = document.createElement("article");
      card.className = "news-card";

      var title = a.url
        ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title) + "</a>"
        : esc(a.title);

      var sentimentChip = a.sentiment
        ? '<span class="news-sentiment ' + sentimentClass(a.sentiment) + '">' + esc(a.sentiment) + "</span>"
        : "";

      var strength = "";
      if (a.signal_strength !== null && a.signal_strength !== undefined) {
        strength =
          '<span class="news-signal"><span class="muted">Signal</span> ' +
          fmtNum(a.signal_strength, 2) + "</span>";
      }

      var signals = "";
      if (a.rvol !== null && a.rvol !== undefined) {
        signals +=
          '<span class="news-signal"><span class="muted">RVOL</span> ' +
          fmtNum(a.rvol, 1) + "</span>";
      }
      if (a.log_return !== null && a.log_return !== undefined) {
        var lrClass = a.log_return > 0 ? "pos" : a.log_return < 0 ? "neg" : "";
        signals +=
          '<span class="news-signal"><span class="muted">ln</span> <span class="' + lrClass + '">' +
          fmtNum(a.log_return, 3) + "</span></span>";
      }

      card.innerHTML =
        '<div class="news-card-head">' +
          '<span class="news-ticker">' + esc(a.ticker) + "</span>" +
          sentimentChip +
          strength +
          signals +
        "</div>" +
        '<div class="news-title">' + title + "</div>" +
        '<div class="news-meta">' +
          '<span class="muted">' + esc(a.source) + " · " + fmtDate(a.published_at) + "</span>" +
          (a.summary ? '<p class="news-summary">' + esc(a.summary).slice(0, 220) + "</p>" : "") +
        "</div>";

      list.appendChild(card);
    });

    if (!rows.length && articles.length) {
      list.innerHTML = '<p class="muted">No headlines match the current filters.</p>';
    }
  }

  function load() {
    var status = document.getElementById("news-status");
    fetch(API_ROOT + "/api/news?limit=200")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        articles = data.items || [];
        render();
      })
      .catch(function (err) {
        if (status) status.textContent = "News unavailable right now (" + err.message + ").";
        var list = document.getElementById("news-list");
        if (list) list.innerHTML = '<p class="muted">Could not load news.</p>';
      });
  }

  function init() {
    var tickerInput = document.getElementById("filter-ticker");
    var sentiment = document.getElementById("filter-sentiment");
    var reset = document.getElementById("btn-reset");

    if (tickerInput) tickerInput.addEventListener("input", function () {
      filterTicker = tickerInput.value.trim();
      render();
    });
    if (sentiment) sentiment.addEventListener("change", function () {
      filterSentiment = sentiment.value;
      render();
    });
    if (reset) reset.addEventListener("click", function () {
      if (tickerInput) tickerInput.value = "";
      if (sentiment) sentiment.value = "";
      filterTicker = "";
      filterSentiment = "";
      render();
    });
  }

  init();
  load();
})();