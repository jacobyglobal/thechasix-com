(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    winRate: $("win-rate"),
    winRateSlider: $("win-rate-slider"),
    avgWin: $("avg-win"),
    avgLoss: $("avg-loss"),
    accountSize: $("account-size"),
    riskPerTrade: $("risk-per-trade"),
    riskPerTradeSlider: $("risk-per-trade-slider"),
    riskHint: $("risk-hint"),
    btnReset: $("btn-reset"),
    expectancyValue: $("expectancy-value"),
    expectancyR: $("expectancy-r"),
    rorGamblerValue: $("ror-gambler-value"),
    rorGamblerInterp: $("ror-gambler-interp"),
    riskMeterGambler: $("risk-meter-gambler"),
    riskMarkerGambler: $("risk-marker-gambler"),
    rorCorneyValue: $("ror-corney-value"),
    rorCorneyInterp: $("ror-corney-interp"),
    riskMeterCorney: $("risk-meter-corney"),
    riskMarkerCorney: $("risk-marker-corney"),
    streakHead: $("streak-head"),
    streakVis: $("streak-vis"),
    streakCaption: $("streak-caption"),
    csvDrop: $("csv-drop"),
    csvFile: $("csv-file"),
    btnPickFile: $("btn-pick-file"),
    csvMessage: $("csv-message"),
    csvConfirm: $("csv-confirm"),
    columnPicker: $("column-picker"),
    colPicker: $("col-picker"),
    btnApplyCol: $("btn-apply-col"),
    tradesCard: $("trades-card"),
    tradeCount: $("trade-count"),
    tradeTable: $("trade-table"),
  };

  var state = {
    headers: [],
    data: [],
    pnlCol: -1,
    dateCol: -1,
    tickerCol: -1,
    trades: [],
    sortKey: "index",
    sortAsc: true,
  };

  var PNL_POS = ["pnl", "pandl", "pl", "profit", "gain", "return", "realized", "proceeds", "netprofit", "amount"];
  var PNL_NEG = ["qty", "quantity", "shares", "position", "open", "high", "low", "volume", "commission", "fee", "rate", "price"];
  var DATE_TOKENS = ["date", "time", "opened", "closed", "execution", "settled", "activity"];
  var TICKER_TOKENS = ["symbol", "ticker", "instrument", "description", "security"];

  function numVal(input) {
    var v = parseFloat(input.value);
    return isNaN(v) ? 0 : v;
  }

  function fmtMoney(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    var sign = v < 0 ? "-" : "";
    return sign + "$" + Math.abs(v).toFixed(2);
  }

  function fmtNum(v, d) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return v.toFixed(d === undefined ? 2 : d);
  }

  function paintValue(el, text, mag) {
    el.textContent = text;
    el.classList.remove("tinted");
    el.style.opacity = "";
    if (mag !== null && mag !== undefined && !isNaN(mag)) {
      el.classList.add("tinted");
      el.style.opacity = String(0.3 + 0.7 * Math.max(0, Math.min(1, mag)));
    }
  }

  function setSub(key, text) {
    var s = document.querySelector('[data-sub="' + key + '"]');
    if (s) s.textContent = text;
  }

  function setStat(key, text, tone) {
    var v = document.querySelector('[data-stat="' + key + '"]');
    if (v) paintValue(v, text, tone);
  }

  function renderAll() {
    var winRate = numVal(el.winRate);
    var avgWin = numVal(el.avgWin);
    var avgLoss = numVal(el.avgLoss);
    var p = winRate / 100;
    var lossRate = 1 - p;
    var expectancy = p * avgWin - lossRate * avgLoss;
    var rMultiple = avgLoss > 0 ? expectancy / avgLoss : null;

    paintValue(el.expectancyValue, fmtMoney(expectancy), rMultiple === null ? null : Math.min(1, Math.abs(rMultiple)));
    el.expectancyR.textContent = "R-multiple: " + (rMultiple === null ? "N/A" : fmtNum(rMultiple));

    var grossWin = p * avgWin;
    var grossLoss = lossRate * avgLoss;
    var profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;
    var winLoss = avgLoss > 0 ? avgWin / avgLoss : null;

    if (profitFactor === null) {
      setStat("profit-factor", "—", null);
      setSub("profit-factor", "Enter Avg Loss");
    } else {
      setStat("profit-factor", fmtNum(profitFactor), Math.min(1, Math.abs(profitFactor - 1)));
      setSub("profit-factor", profitFactor >= 1.3 ? "Profit factor at or above 1.3" : profitFactor >= 1 ? "Profit factor at or above 1" : "Profit factor below 1");
    }

    if (winLoss === null) {
      setStat("win-loss", "—", null);
      setSub("win-loss", "Enter Avg Loss");
    } else {
      setStat("win-loss", fmtNum(winLoss), Math.min(1, Math.abs(winLoss - 1)));
      setSub("win-loss", "avg win per $1 lost");
    }

    if (rMultiple === null) {
      setStat("expectancy-r", "—", null);
      setSub("expectancy-r", "Enter Avg Loss");
    } else {
      setStat("expectancy-r", fmtNum(rMultiple), Math.min(1, Math.abs(rMultiple)));
      setSub("expectancy-r", rMultiple > 0 ? "Expectancy above $0" : "Expectancy at or below $0");
    }

    renderTradeStats();
    renderRor();
  }

  function renderTradeStats() {
    var trades = state.trades;
    var sharpe = computeSharpe(trades);
    var maxConsec = computeMaxConsec(trades);
    var dd = computeDrawdown(trades);

    if (trades.length === 0) {
      setStat("sharpe", "—", null);
      setSub("sharpe", "Upload a trade log");
      setStat("max-consec", "—", null);
      setSub("max-consec", "Upload a trade log");
      setStat("max-dd", "—", null);
      setSub("max-dd", "Upload a trade log");
      return;
    }

    if (sharpe === null) {
      setStat("sharpe", "—", null);
      setSub("sharpe", "Need 2+ trades");
    } else {
      setStat("sharpe", fmtNum(sharpe), Math.min(1, Math.abs(sharpe)));
      setSub("sharpe", sharpe >= 1 ? "Above 1" : sharpe >= 0 ? "Between 0 and 1" : "Below 0");
    }

    setStat("max-consec", String(maxConsec), Math.min(1, maxConsec / 5));
    setSub("max-consec", "In your trade history");

    var ddText = dd.dollars > 0 ? fmtMoney(dd.dollars) + " (" + fmtNum(dd.pct, 1) + "%)" : "$0.00";
    setStat("max-dd", ddText, dd.dollars > 0 ? Math.min(1, dd.pct / 100) : null);
    setSub("max-dd", "Largest peak-to-trough");
  }

  function computeSharpe(trades) {
    if (trades.length < 2) return null;
    var i, mean = 0;
    for (i = 0; i < trades.length; i++) mean += trades[i].pnl;
    mean /= trades.length;
    var sum = 0;
    for (i = 0; i < trades.length; i++) sum += (trades[i].pnl - mean) * (trades[i].pnl - mean);
    var std = Math.sqrt(sum / (trades.length - 1));
    if (std === 0) return null;
    return mean / std;
  }

  function computeMaxConsec(trades) {
    var best = 0, cur = 0;
    trades.forEach(function (t) {
      if (t.pnl < 0) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
    });
    return best;
  }

  function computeDrawdown(trades) {
    var peak = 0, equity = 0, maxDd = 0;
    trades.forEach(function (t) {
      equity += t.pnl;
      if (equity > peak) peak = equity;
      if (peak - equity > maxDd) maxDd = peak - equity;
    });
    return { dollars: maxDd, pct: peak > 0 ? (maxDd / peak) * 100 : 0 };
  }

  function paintRorCard(valueEl, interpEl, meterEl, markerEl, rorPct, interp) {
    if (rorPct === null) {
      paintValue(valueEl, "—", null);
      interpEl.textContent = interp || "";
      meterEl.hidden = true;
      return;
    }
    var clamped = Math.max(0, Math.min(100, rorPct));
    var label = clamped < 0.01 && clamped > 0 ? "<0.01%" : fmtNum(clamped) + "%";
    paintValue(valueEl, label, clamped / 100);
    interpEl.textContent = interp || "";
    meterEl.hidden = false;
    markerEl.style.left = clamped + "%";
  }

  function clearStreak() {
    el.streakHead.innerHTML = "";
    el.streakVis.innerHTML = "";
    el.streakCaption.textContent = "";
  }

  function buildStreakVis(consec, riskPct) {
    var MAX_BARS = 60;
    el.streakVis.innerHTML = "";
    var bars = [];
    var step = Math.max(1, Math.ceil(consec / MAX_BARS));
    var k;
    for (k = step; k <= consec; k += step) bars.push(k);
    if (bars.length === 0 || bars[bars.length - 1] !== consec) bars.push(consec);
    bars.forEach(function (losses) {
      var remaining = Math.max(0, 100 - losses * riskPct);
      var bar = document.createElement("span");
      bar.className = "decline-bar";
      bar.style.height = Math.max(6, remaining) + "%";
      bar.style.opacity = String(0.15 + 0.85 * Math.min(1, (100 - remaining) / 100));
      bar.title = "After " + losses + " consecutive loss" + (losses === 1 ? "" : "es") + ": " + remaining.toFixed(0) + "% of account remains";
      el.streakVis.appendChild(bar);
    });
    el.streakHead.innerHTML = "You can survive <strong>" + consec + "</strong> consecutive loss" + (consec === 1 ? "" : "es");
    el.streakCaption.textContent = "Each bar is your account after that many losses in a row — bars get shorter and darker as the account is depleted.";
  }

  function gamblersRuinRor(eR, winR, p, units) {
    var varR = p * winR * winR + (1 - p) - eR * eR;
    var sdR = Math.sqrt(varR);
    var z = eR / sdR;
    if (z >= 1) return 0;
    return Math.pow((1 - z) / (1 + z), units) * 100;
  }

  function renderRor() {
    var winRate = numVal(el.winRate);
    var avgWin = numVal(el.avgWin);
    var avgLoss = numVal(el.avgLoss);
    var account = numVal(el.accountSize);
    var risk = numVal(el.riskPerTrade);
    var p = winRate / 100;
    var expectancy = p * avgWin - (1 - p) * avgLoss;

    if (risk > 0) {
      var consec = Math.floor(100 / risk);
      el.riskHint.textContent = consec > 0 ? "You can survive " + consec + " consecutive loss" + (consec === 1 ? "" : "es") + "." : "";
    } else {
      el.riskHint.textContent = "";
    }

    if (expectancy <= 0) {
      var noEdge = "Expectancy is not positive — over enough trades, ruin approaches certainty.";
      paintRorCard(el.rorGamblerValue, el.rorGamblerInterp, el.riskMeterGambler, el.riskMarkerGambler, 100, noEdge);
      paintRorCard(el.rorCorneyValue, el.rorCorneyInterp, el.riskMeterCorney, el.riskMarkerCorney, 100, noEdge);
      clearStreak();
      return;
    }

    if (avgLoss <= 0) {
      paintRorCard(el.rorGamblerValue, el.rorGamblerInterp, el.riskMeterGambler, el.riskMarkerGambler, null, "Enter Average Loss.");
    } else if (risk <= 0) {
      paintRorCard(el.rorGamblerValue, el.rorGamblerInterp, el.riskMeterGambler, el.riskMarkerGambler, null, "Enter Risk per Trade.");
    } else if (p <= 0 || avgWin <= 0) {
      paintRorCard(el.rorGamblerValue, el.rorGamblerInterp, el.riskMeterGambler, el.riskMarkerGambler, null, "Enter Win %, Average Win and Average Loss.");
    } else {
      var winR = avgWin / avgLoss;
      var eR = p * winR - (1 - p);
      var ror = eR <= 0 ? 100 : gamblersRuinRor(eR, winR, p, 100 / risk);
      var interp = ror < 1 ? "Ruin probability below 1%." : ror <= 20 ? "Ruin probability between 1% and 20%." : "Ruin probability above 20%.";
      paintRorCard(el.rorGamblerValue, el.rorGamblerInterp, el.riskMeterGambler, el.riskMarkerGambler, ror, interp);
    }

    if (risk <= 0) {
      paintRorCard(el.rorCorneyValue, el.rorCorneyInterp, el.riskMeterCorney, el.riskMarkerCorney, null, "Enter Risk per Trade.");
      clearStreak();
    } else if (account <= 0 || p <= 0) {
      paintRorCard(el.rorCorneyValue, el.rorCorneyInterp, el.riskMeterCorney, el.riskMarkerCorney, null, "Enter Win % and Account Size.");
      clearStreak();
    } else {
      var consec = Math.floor(100 / risk);
      var ror2 = Math.pow(1 - p, consec) * 100;
      var interp2 = ror2 < 1 ? "Ruin probability below 1%." : ror2 <= 20 ? "Ruin probability between 1% and 20%." : "Ruin probability above 20%.";
      paintRorCard(el.rorCorneyValue, el.rorCorneyInterp, el.riskMeterCorney, el.riskMarkerCorney, ror2, interp2);
      buildStreakVis(consec, risk);
    }
  }

  function normalizeHeader(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function containsAny(n, tokens) {
    for (var i = 0; i < tokens.length; i++) {
      if (n.indexOf(tokens[i]) !== -1) return true;
    }
    return false;
  }

  function scorePnL(name) {
    var n = normalizeHeader(name);
    if (!n) return -1;
    if (n === "pl") return 6;
    var pos = 0;
    for (var i = 0; i < PNL_POS.length; i++) if (n.indexOf(PNL_POS[i]) !== -1) pos++;
    var neg = 0;
    for (var j = 0; j < PNL_NEG.length; j++) if (n.indexOf(PNL_NEG[j]) !== -1) neg++;
    if (pos === 0 && neg > 0) return -10;
    var gainLossBonus = n.indexOf("gain") !== -1 && n.indexOf("loss") !== -1 ? 4 : 0;
    return pos * 6 - neg * 2 + gainLossBonus;
  }

  function scoreDate(name) {
    var n = normalizeHeader(name);
    if (!n) return -1;
    var hits = 0;
    for (var i = 0; i < DATE_TOKENS.length; i++) if (n.indexOf(DATE_TOKENS[i]) !== -1) hits++;
    return hits > 0 ? hits * 6 : 0;
  }

  function scoreTicker(name) {
    var n = normalizeHeader(name);
    if (!n) return -1;
    if (n === "symbol" || n === "ticker") return 8;
    var hits = 0;
    for (var i = 0; i < TICKER_TOKENS.length; i++) if (n.indexOf(TICKER_TOKENS[i]) !== -1) hits++;
    return hits > 0 ? hits * 4 : 0;
  }

  function splitCsvLine(line, delim) {
    var out = [], cur = "", inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (line.charAt(i + 1) === '"') { cur += '"'; i++; }
          else inQ = false;
        } else {
          cur += c;
        }
      } else if (c === '"') {
        inQ = true;
      } else if (c === delim) {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  function detectDelimiter(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; }).slice(0, 10);
    var candidates = [",", ";", "\t"];
    var best = ",", bestScore = -1;
    candidates.forEach(function (d) {
      var counts = lines.map(function (l) { return splitCsvLine(l, d).length; });
      var mode = counts[0] || 1;
      var freq = {};
      counts.forEach(function (c) { freq[c] = (freq[c] || 0) + 1; });
      var max = 0, bestCount = 0;
      for (var k in freq) {
        if (freq[k] > max) { max = freq[k]; bestCount = Number(k); }
      }
      var score = max * (bestCount > 1 ? 1 : 0);
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }

  function looksLikeHeader(row) {
    var nonEmpty = 0;
    for (var i = 0; i < row.length; i++) if (String(row[i]).trim()) nonEmpty++;
    if (nonEmpty < 2) return false;
    var pnl = false, date = false, ticker = false;
    for (var j = 0; j < row.length; j++) {
      if (scorePnL(row[j]) >= 6) pnl = true;
      if (scoreDate(row[j]) >= 6) date = true;
      if (scoreTicker(row[j]) >= 6) ticker = true;
    }
    return (pnl ? 1 : 0) + (date ? 1 : 0) + (ticker ? 1 : 0) >= 2;
  }

  function parseCsv(text) {
    var delim = detectDelimiter(text);
    var rows = [];
    text.split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      rows.push(splitCsvLine(line.trim(), delim));
    });
    if (rows.length < 2) return null;
    var hi = 0;
    var limit = Math.min(rows.length, 8);
    for (var i = 0; i < limit; i++) {
      if (looksLikeHeader(rows[i])) { hi = i; break; }
    }
    return { headers: rows[hi], data: rows.slice(hi + 1) };
  }

  function detectColumns(headers, data) {
    var best = { pnl: -1, date: -1, ticker: -1 };
    var pnlScore = -Infinity, dateScore = 0, tickerScore = 0;
    headers.forEach(function (h, i) {
      var sp = scorePnL(h);
      if (sp > pnlScore) { pnlScore = sp; best.pnl = i; }
      var sd = scoreDate(h);
      if (sd > dateScore) { dateScore = sd; best.date = i; }
      var st = scoreTicker(h);
      if (st > tickerScore) { tickerScore = st; best.ticker = i; }
    });
    if (best.pnl >= 0 && pnlScore < 0) best.pnl = -1;
    return { pnl: best.pnl, date: best.date, ticker: best.ticker, pnlScore: pnlScore };
  }

  function parseNum(v) {
    if (v === null || v === undefined) return NaN;
    var s = String(v).trim();
    if (!s || s.toLowerCase() === "n/a" || s.toLowerCase() === "na" || s === "-") return NaN;
    var neg = false;
    if (s.charAt(0) === "(" && s.charAt(s.length - 1) === ")") {
      neg = true;
      s = s.slice(1, -1);
    }
    s = s.replace(/[$,%\s\u00a0]/g, "");
    if (s.charAt(0) === "-") { neg = true; s = s.slice(1); }
    if (/-\s*$/.test(s)) { neg = true; s = s.replace(/-\s*$/, ""); }
    var n = parseFloat(s);
    if (isNaN(n)) return NaN;
    return neg ? -n : n;
  }

  function parseDate(s) {
    if (!s) return null;
    var ts = Date.parse(s);
    return isNaN(ts) ? null : ts;
  }

  function extractTrades() {
    var trades = [];
    state.data.forEach(function (row) {
      var pnl = parseNum(row[state.pnlCol]);
      if (isNaN(pnl)) return;
      var t = { pnl: pnl, date: null, dateLabel: "", ticker: "" };
      if (state.dateCol >= 0 && row[state.dateCol] !== undefined) {
        t.dateLabel = String(row[state.dateCol]).trim();
        t.date = parseDate(t.dateLabel);
      }
      if (state.tickerCol >= 0 && row[state.tickerCol] !== undefined) {
        t.ticker = String(row[state.tickerCol]).trim();
      }
      trades.push(t);
    });
    if (state.dateCol >= 0) {
      var dated = trades.filter(function (t) { return t.date !== null; });
      if (dated.length >= 2 && dated.length === trades.length) {
        trades.sort(function (a, b) { return a.date - b.date; });
      }
    }
    var equity = 0, wins = 0;
    trades.forEach(function (t, i) {
      t.index = i + 1;
      equity += t.pnl;
      if (t.pnl > 0) wins++;
      t.equity = equity;
      t.cumWin = (wins / (i + 1)) * 100;
    });
    return trades;
  }

  function populateInputsFromTrades() {
    var wins = 0, winSum = 0, losses = 0, lossSum = 0;
    state.trades.forEach(function (t) {
      if (t.pnl > 0) { wins++; winSum += t.pnl; }
      else if (t.pnl < 0) { losses++; lossSum += Math.abs(t.pnl); }
    });
    var total = state.trades.length;
    var winRate = total > 0 ? (wins / total) * 100 : 0;
    var avgWin = wins > 0 ? winSum / wins : 0;
    var avgLoss = losses > 0 ? lossSum / losses : 0;
    el.winRate.value = winRate.toFixed(1);
    el.winRateSlider.value = String(Math.round(winRate));
    el.avgWin.value = avgWin.toFixed(2);
    el.avgLoss.value = avgLoss.toFixed(2);
  }

  function renderTrades() {
    var tbody = el.tradeTable.querySelector("tbody");
    if (!tbody) return;
    var sorted = state.trades.slice().sort(function (a, b) {
      if (state.sortKey === "ticker") {
        var av = String(a.ticker || ""), bv = String(b.ticker || "");
        return state.sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      var x = a[state.sortKey], y = b[state.sortKey];
      if (state.sortKey === "date") {
        if (x === null && y === null) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
      }
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return state.sortAsc ? x - y : y - x;
    });
    tbody.innerHTML = "";
    sorted.forEach(function (t) {
      var tr = document.createElement("tr");
      var cls = t.pnl > 0 ? "pos" : t.pnl < 0 ? "neg" : "";
      var pnlCell = "<td" + (cls ? " class='" + cls + "'" : "") + ">" + fmtMoney(t.pnl) + "</td>";
      tr.innerHTML =
        "<td>" + t.index + "</td>" +
        "<td>" + (t.dateLabel || "—") + "</td>" +
        "<td>" + (t.ticker || "—") + "</td>" +
        pnlCell +
        "<td>" + fmtMoney(t.equity) + "</td>" +
        "<td>" + fmtNum(t.cumWin, 1) + "%</td>";
      tbody.appendChild(tr);
    });
  }

  function paintTradeSort() {
    el.tradeTable.querySelectorAll("th[data-sort]").forEach(function (th) {
      th.classList.toggle("sorted", th.getAttribute("data-sort") === state.sortKey);
      th.classList.toggle("desc", th.getAttribute("data-sort") === state.sortKey && !state.sortAsc);
    });
  }

  function extractAndRender() {
    state.trades = extractTrades();
    if (state.trades.length === 0) {
      el.csvMessage.textContent = "No numeric P&L values found in '" + state.headers[state.pnlCol] + "'. Check the column mapping.";
      el.tradesCard.hidden = true;
      return;
    }
    populateInputsFromTrades();
    el.tradesCard.hidden = false;
    el.tradeCount.textContent = state.trades.length + " trade" + (state.trades.length === 1 ? "" : "s") + " from '" + state.headers[state.pnlCol] + "'" + (state.dateCol >= 0 ? ", sorted by date" : "") + ".";
    renderTrades();
    paintTradeSort();
    renderAll();
  }

  function showColumnPicker() {
    el.colPicker.innerHTML = "";
    var none = document.createElement("option");
    none.value = "-1";
    none.textContent = "None of these";
    el.colPicker.appendChild(none);
    state.headers.forEach(function (h, i) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = h;
      el.colPicker.appendChild(opt);
    });
    el.colPicker.value = String(state.pnlCol >= 0 ? state.pnlCol : -1);
    el.columnPicker.hidden = false;
    el.csvConfirm.hidden = true;
    el.csvMessage.textContent = "We couldn't find a profit/loss column automatically. Select it manually:";
  }

  function autoSelect() {
    extractAndRender();
    var header = state.headers[state.pnlCol];
    var n = state.trades.length;
    el.csvMessage.textContent = "";
    el.csvConfirm.innerHTML = "";
    var span = document.createElement("span");
    span.textContent = "Detected '" + header + "' as your profit column — " + n + " trade" + (n === 1 ? "" : "s") + " found. ";
    el.csvConfirm.appendChild(span);
    var change = document.createElement("button");
    change.type = "button";
    change.className = "link-btn";
    change.textContent = "Change";
    change.addEventListener("click", function () { showColumnPicker(); });
    el.csvConfirm.appendChild(change);
    el.csvConfirm.hidden = false;
    el.columnPicker.hidden = true;
  }

  function processCsvText(text) {
    if (!text.trim()) {
      el.csvMessage.textContent = "Please select a CSV file.";
      return;
    }
    var parsed = parseCsv(text);
    if (!parsed || parsed.data.length === 0) {
      el.csvMessage.textContent = "This file has no data rows. Please select a valid CSV export from your broker.";
      return;
    }
    state.headers = parsed.headers;
    state.data = parsed.data;
    var det = detectColumns(parsed.headers, parsed.data);
    state.pnlCol = det.pnl;
    state.dateCol = det.date;
    state.tickerCol = det.ticker;
    if (det.pnlScore >= 6) {
      autoSelect();
    } else {
      state.pnlCol = -1;
      showColumnPicker();
    }
  }

  function handleFile(file) {
    if (!file) return;
    el.csvMessage.textContent = "";
    var reader = new FileReader();
    reader.onload = function (e) {
      processCsvText(String(e.target.result));
    };
    reader.onerror = function () {
      el.csvMessage.textContent = "Couldn't read this file. Try again.";
    };
    reader.readAsText(file);
  }

  function reset() {
    el.winRate.value = "50";
    el.winRateSlider.value = "50";
    el.avgWin.value = "100";
    el.avgLoss.value = "50";
    el.accountSize.value = "10000";
    el.riskPerTrade.value = "1";
    el.riskPerTradeSlider.value = "1";
    state.headers = [];
    state.data = [];
    state.pnlCol = -1;
    state.dateCol = -1;
    state.tickerCol = -1;
    state.trades = [];
    state.sortKey = "index";
    state.sortAsc = true;
    el.tradesCard.hidden = true;
    el.csvConfirm.hidden = true;
    el.columnPicker.hidden = true;
    clearStreak();
    el.csvMessage.textContent = "";
    el.csvFile.value = "";
    renderAll();
  }

  function init() {
    var slider = el.winRateSlider;
    slider.addEventListener("input", function () {
      el.winRate.value = slider.value;
      renderAll();
    });
    el.winRate.addEventListener("input", function () {
      slider.value = el.winRate.value;
      renderAll();
    });
    var riskSlider = el.riskPerTradeSlider;
    riskSlider.addEventListener("input", function () {
      el.riskPerTrade.value = riskSlider.value;
      renderAll();
    });
    el.riskPerTrade.addEventListener("input", function () {
      riskSlider.value = el.riskPerTrade.value;
      renderAll();
    });
    ["avg-win", "avg-loss", "account-size"].forEach(function (id) {
      $(id).addEventListener("input", renderAll);
    });

    el.btnReset.addEventListener("click", reset);

    el.btnPickFile.addEventListener("click", function (e) {
      e.stopPropagation();
      el.csvFile.click();
    });
    el.csvDrop.addEventListener("click", function () { el.csvFile.click(); });
    el.csvFile.addEventListener("change", function () {
      handleFile(el.csvFile.files && el.csvFile.files[0]);
    });
    ["dragenter", "dragover"].forEach(function (evt) {
      el.csvDrop.addEventListener(evt, function (e) {
        e.preventDefault();
        el.csvDrop.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach(function (evt) {
      el.csvDrop.addEventListener(evt, function (e) {
        e.preventDefault();
        el.csvDrop.classList.remove("dragover");
      });
    });
    el.csvDrop.addEventListener("drop", function (e) {
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handleFile(file);
    });

    el.btnApplyCol.addEventListener("click", function () {
      var idx = Number(el.colPicker.value);
      if (idx < 0) {
        el.csvMessage.textContent = "No P&L column selected.";
        return;
      }
      state.pnlCol = idx;
      el.columnPicker.hidden = true;
      el.csvMessage.textContent = "";
      autoSelect();
    });

    el.tradeTable.querySelectorAll("th[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-sort");
        if (state.sortKey === key) state.sortAsc = !state.sortAsc;
        else { state.sortKey = key; state.sortAsc = true; }
        paintTradeSort();
        renderTrades();
      });
    });

    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
