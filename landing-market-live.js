(function () {
  "use strict";
  const SUPABASE_URL = "https://ztiiyulusburxjkpcfxu.supabase.co";
  const SUPABASE_KEY = "sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_";
  const EDGE_URL = SUPABASE_URL + "/functions/v1/market-data";
  const WATCH = [
    { symbol: "EURUSD", provider: "EUR/USD", market: "Forex", decimals: 5 },
    { symbol: "GBPUSD", provider: "GBP/USD", market: "Forex", decimals: 5 },
    { symbol: "XAUUSD", provider: "XAU/USD", market: "Gold", decimals: 2 },
    { symbol: "BTCUSDT", provider: "BINANCE", market: "Crypto", decimals: 2 },
    { symbol: "NAS100", provider: "NDX", market: "Index", decimals: 2 }
  ];
  const tableBody = () => document.querySelector("#live-market-table tbody");
  const fmt = (value, decimals) => Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals
  });
  const statusEl = () => document.getElementById("market-feed-status");
  const timeEl = () => document.getElementById("market-updated");
  let activeFilter = "All";
  let busy = false;

  function setStatus(message, state) {
    const el = statusEl();
    if (!el) return;
    el.textContent = message;
    el.dataset.state = state || "neutral";
  }
  function paint(rows) {
    const body = tableBody();
    if (!body) return;
    body.innerHTML = rows.map(row => {
      const change = Number(row.change);
      const changeText = Number.isFinite(change)
        ? (change > 0 ? "+" : "") + change.toFixed(2) + "%"
        : "—";
      const changeClass = !Number.isFinite(change) ? "neutral" : change >= 0 ? "positive" : "negative";
      const priceText = Number.isFinite(Number(row.price)) ? fmt(row.price, row.decimals) : "Unavailable";
      const marketState = row.marketOpen === false ? "Market closed" : row.live ? "Connected" : "Connecting";
      return '<tr data-market="' + row.market + '">' +
        '<td><b class="market-symbol">' + row.symbol + '</b><small class="market-source">' + row.source + '</small></td>' +
        '<td><span class="market-type">' + row.market + '</span></td>' +
        '<td class="market-price">' + priceText + '</td>' +
        '<td class="' + changeClass + '">' + changeText + '</td>' +
        '<td><span class="market-state ' + (row.live ? "is-live" : "is-waiting") + '">' + marketState + '</span></td>' +
        '</tr>';
    }).join("");
    filterRows();
  }
  function filterRows() {
    document.querySelectorAll(".market-tabs [data-market-filter]").forEach(tab => {
      const selected = tab.dataset.marketFilter === activeFilter;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    document.querySelectorAll("#live-market-table tbody tr").forEach(row => {
      row.hidden = activeFilter !== "All" && row.dataset.market !== activeFilter;
    });
  }
  async function loadTwelveData() {
    const response = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
      body: "{}",
      cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || "Market provider unavailable");
    return data.quotes || [];
  }
  async function loadBitcoin() {
    const response = await fetch("https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT", { cache: "no-store" });
    if (!response.ok) throw new Error("Binance quote unavailable");
    const q = await response.json();
    return {
      symbol: "BTCUSDT", market: "Crypto", price: Number(q.lastPrice),
      change: Number(q.priceChangePercent), decimals: 2, source: "BINANCE SPOT",
      live: true, marketOpen: true
    };
  }
  async function refresh() {
    if (busy || !tableBody()) return;
    busy = true;
    setStatus("Connecting to market feeds…", "loading");
    try {
      const [twelveResult, btcResult] = await Promise.allSettled([loadTwelveData(), loadBitcoin()]);
      const twelve = twelveResult.status === "fulfilled" ? twelveResult.value : [];
      const bySymbol = new Map(twelve.map(q => [String(q.symbol || "").toUpperCase().replace("/", ""), q]));
      const rows = WATCH.map(item => {
        if (item.symbol === "BTCUSDT") {
          return btcResult.status === "fulfilled" ? btcResult.value : {
            ...item, price: NaN, change: NaN, source: "BINANCE", live: false
          };
        }
        const q = bySymbol.get(item.provider.toUpperCase().replace("/", "")) ||
          bySymbol.get(item.symbol);
        const price = q ? Number(q.close || q.price) : NaN;
        const pct = q ? Number(q.percent_change) : NaN;
        return {
          ...item, price, change: pct, source: "TWELVE DATA",
          live: Number.isFinite(price), marketOpen: q && q.is_market_open === false ? false : true
        };
      });
      paint(rows);
      const good = rows.filter(r => r.live).length;
      setStatus(good === rows.length ? "MARKET FEED CONNECTED" : good ? "PARTIAL FEED CONNECTION" : "FEED CONNECTION REQUIRED", good ? "live" : "error");
      if (timeEl()) timeEl().textContent = "Updated " + new Date().toLocaleTimeString();
      if (twelveResult.status === "rejected" && btcResult.status === "rejected") {
        setStatus("Market feed unavailable · retrying", "error");
      }
    } catch (error) {
      setStatus("Market feed unavailable · " + error.message, "error");
    } finally {
      busy = false;
    }
  }
  function init() {
    document.querySelectorAll(".market-tabs [data-market-filter]").forEach(tab => {
      tab.addEventListener("click", () => {
        activeFilter = tab.dataset.marketFilter;
        filterRows();
      });
    });
    refresh();
    window.setInterval(refresh, 60000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();