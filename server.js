const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.set("json spaces", 2);

const PORT = process.env.PORT || 3000;

// ===== CONFIG =====
const API_URL = "https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau";
const ADMIN = "@vanminh2603";

// ===== CACHE =====
let cache = null;
let lastFetch = 0;
let lastSessionId = null;

const FETCH_INTERVAL = 30000;

// ===== HELPER =====
function getTaiXiu(v) {
  return v >= 11 ? "TÀI" : "XỈU";
}

function getChanLe(v) {
  return v % 2 === 0 ? "CHẴN" : "LẺ";
}

// ===== MARKOV PRO =====
function markovPredict(history) {
  if (!history || history.length < 3) {
    return { predict: "ĐANG PHÂN TÍCH", confidence: 0 };
  }

  let map = {};

  for (let i = 0; i < history.length - 1; i++) {
    let a = history[i];
    let b = history[i + 1];

    if (!map[a]) map[a] = {};
    map[a][b] = (map[a][b] || 0) + 1;
  }

  let last = history[history.length - 1];
  let next = map[last] || {};

  let total = Object.values(next).reduce((a, b) => a + b, 0);
  let best = "ĐANG PHÂN TÍCH";
  let max = 0;

  for (let k in next) {
    if (next[k] > max) {
      max = next[k];
      best = k;
    }
  }

  return {
    predict: best,
    confidence: total ? ((max / total) * 100).toFixed(2) + "%" : "0%"
  };
}

// ===== PATTERN PRO =====
function analyzePattern(results) {
  let tx = results.map(getTaiXiu);
  let cl = results.map(getChanLe);

  let pattern = {
    bet: "ĐANG PHÂN TÍCH",
    type: "NONE",
    streak: 0
  };

  if (tx.length < 3) return { tx, cl, pattern };

  let last = tx[tx.length - 1];
  let streak = 1;

  for (let i = tx.length - 2; i >= 0; i--) {
    if (tx[i] === last) streak++;
    else break;
  }

  // ===== CẦU BỆT =====
  if (streak >= 3) {
    pattern = {
      bet: last,
      type: "CẦU BỆT",
      streak
    };
  }

  // ===== CẦU 1-1 =====
  let is11 = true;
  for (let i = tx.length - 1; i > tx.length - 6; i--) {
    if (tx[i] === tx[i - 1]) is11 = false;
  }

  if (is11) {
    pattern = {
      bet: last === "TÀI" ? "XỈU" : "TÀI",
      type: "CẦU 1-1",
      streak: 1
    };
  }

  // ===== CẦU 2-2 =====
  let is22 = true;
  for (let i = tx.length - 1; i > tx.length - 8; i -= 2) {
    if (tx[i] !== tx[i - 1]) is22 = false;
  }

  if (is22) {
    pattern = {
      bet: last === "TÀI" ? "XỈU" : "TÀI",
      type: "CẦU 2-2",
      streak: 2
    };
  }

  // ===== CẦU 2-1 =====
  let last3 = tx.slice(-3).join("-");
  if (last3 === "TÀI-TÀI-XỈU" || last3 === "XỈU-XỈU-TÀI") {
    pattern = {
      bet: last,
      type: "CẦU 2-1",
      streak: 3
    };
  }

  return { tx, cl, pattern };
}

// ===== WINRATE =====
function calculateWinrate(arr) {
  if (!arr || arr.length < 2) return "0.00";

  let win = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) win++;
  }

  return ((win / (arr.length - 1)) * 100).toFixed(2);
}

// ===== AI ĐÁNH GIÁ =====
function evaluateAI(pattern, markov) {
  let score = 0;

  if (pattern.type !== "NONE") score += 30;
  if (pattern.streak >= 3) score += 30;
  if (markov.confidence !== "0%") score += 40;

  if (score >= 80) return "🔥 TỶ LỆ CAO - CÓ THỂ CHƠI";
  if (score >= 50) return "⚠️ ỔN - CÂN NHẮC";
  return "❌ RỦI RO CAO - KHÔNG NÊN CHƠI";
}

// ===== FETCH =====
async function fetchData() {
  const now = Date.now();

  if (cache && now - lastFetch < FETCH_INTERVAL) {
    return cache;
  }

  try {
    const res = await axios.get(API_URL);
    const data = res.data;

    if (data?.sessionId === lastSessionId) return cache;

    lastSessionId = data?.sessionId;
    lastFetch = now;

    let results = Array.isArray(data?.data)
      ? data.data.map(x => Number(x.total)).filter(x => !isNaN(x))
      : [];

    let analysis = analyzePattern(results);
    let markovTX = markovPredict(analysis.tx);
    let markovCL = markovPredict(analysis.cl);

    let winrate = calculateWinrate(analysis.tx);
    let ai = evaluateAI(analysis.pattern, markovTX);

    cache = {
      admin: ADMIN,
      session: data.sessionId || "UNKNOWN",
      time: new Date().toLocaleString("vi-VN"),

      // giữ API gốc
      original: data,

      results: data.data || [],

      analysis: {
        pattern: analysis.pattern,
        markov_taixiu: markovTX,
        markov_chanle: markovCL,
        winrate: winrate + "%",
        ai_danhgia: ai
      }
    };

    return cache;
  } catch (e) {
    return {
      admin: ADMIN,
      error: "API LỖI"
    };
  }
}

// ===== ROUTES =====
app.get("/", (req, res) => {
  res.json({ status: "VIP PRO MAX", admin: ADMIN });
});

app.get("/get", async (req, res) => {
  res.json(await fetchData());
});

app.get("/taixiumd5", async (req, res) => {
  res.json(await fetchData());
});

app.get("/predict", async (req, res) => {
  let data = await fetchData();
  res.json(data.analysis);
});

// ===== START =====
app.listen(PORT, () => {
  console.log("🔥 TAIXIU VIP PRO MAX RUNNING PORT " + PORT);
});
