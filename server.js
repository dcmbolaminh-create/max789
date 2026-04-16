const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ===== CONFIG =====
const API_URL = "https://taixiumd5.maksh3979madfw.com/api/md5luckydice/GetSoiCau";
const ADMIN = "@vanminh2603";

// ===== CACHE =====
let cache = null;
let lastFetch = 0;
let lastSessionId = null;

// ===== CONFIG TIME =====
const FETCH_INTERVAL = 30000; // 30s

// ===== HELPER =====
function getTaiXiu(value) {
  return value >= 11 ? "TÀI" : "XỈU";
}

function getChanLe(value) {
  return value % 2 === 0 ? "CHẴN" : "LẺ";
}

// ===== MARKOV AI =====
function markovPredict(history) {
  let transitions = {};

  for (let i = 0; i < history.length - 1; i++) {
    let curr = history[i];
    let next = history[i + 1];

    if (!transitions[curr]) transitions[curr] = {};
    if (!transitions[curr][next]) transitions[curr][next] = 0;

    transitions[curr][next]++;
  }

  let last = history[history.length - 1];
  let nextStates = transitions[last] || {};

  let max = 0;
  let predict = "UNKNOWN";

  for (let key in nextStates) {
    if (nextStates[key] > max) {
      max = nextStates[key];
      predict = key;
    }
  }

  return {
    predict,
    confidence: max
  };
}

// ===== PATTERN ANALYSIS =====
function analyzePattern(results) {
  let tx = results.map(x => getTaiXiu(x));
  let cl = results.map(x => getChanLe(x));

  let pattern = {
    bet: null,
    type: "",
    streak: 0
  };

  // cầu bệt
  let last = tx[tx.length - 1];
  let streak = 1;

  for (let i = tx.length - 2; i >= 0; i--) {
    if (tx[i] === last) streak++;
    else break;
  }

  if (streak >= 3) {
    pattern.bet = last;
    pattern.type = "CẦU BỆT";
    pattern.streak = streak;
  }

  // cầu 1-1
  let is11 = true;
  for (let i = tx.length - 1; i > tx.length - 6; i--) {
    if (tx[i] === tx[i - 1]) {
      is11 = false;
      break;
    }
  }

  if (is11) {
    pattern.bet = tx[tx.length - 1] === "TÀI" ? "XỈU" : "TÀI";
    pattern.type = "CẦU 1-1";
  }

  // cầu 2-2
  let is22 = true;
  for (let i = tx.length - 1; i > tx.length - 8; i -= 2) {
    if (!(tx[i] === tx[i - 1])) {
      is22 = false;
      break;
    }
  }

  if (is22) {
    pattern.bet = tx[tx.length - 1] === "TÀI" ? "XỈU" : "TÀI";
    pattern.type = "CẦU 2-2";
  }

  // cầu 2-1
  let last3 = tx.slice(-3).join("-");
  if (last3 === "TÀI-TÀI-XỈU" || last3 === "XỈU-XỈU-TÀI") {
    pattern.bet = tx[tx.length - 1];
    pattern.type = "CẦU 2-1";
  }

  return {
    taiXiu: tx,
    chanLe: cl,
    pattern
  };
}

// ===== WINRATE =====
function calculateWinrate(results) {
  let correct = 0;

  for (let i = 0; i < results.length - 1; i++) {
    if (results[i] === results[i + 1]) correct++;
  }

  return ((correct / results.length) * 100).toFixed(2);
}

// ===== FETCH API =====
async function fetchData() {
  const now = Date.now();

  if (cache && now - lastFetch < FETCH_INTERVAL) {
    return cache;
  }

  try {
    const res = await axios.get(API_URL);
    let data = res.data;

    // tránh trùng phiên
    if (data?.sessionId === lastSessionId) {
      return cache;
    }

    lastSessionId = data?.sessionId;
    lastFetch = now;

    let results = data?.data?.map(x => x.total) || [];

    let analysis = analyzePattern(results);
    let markovTX = markovPredict(analysis.taiXiu);
    let markovCL = markovPredict(analysis.chanLe);

    let winrate = calculateWinrate(analysis.taiXiu);

    cache = {
      admin: ADMIN,
      session: data.sessionId,
      time: new Date().toLocaleString("vi-VN"),
      results: data.data,

      analysis: {
        pattern: analysis.pattern,
        markov_taixiu: markovTX,
        markov_chanle: markovCL,
        winrate: winrate + "%"
      }
    };

    return cache;
  } catch (err) {
    return {
      error: "API lỗi",
      admin: ADMIN
    };
  }
}

// ===== ROUTES =====
app.get("/", (req, res) => {
  res.json({
    status: "VIP PRO MAX RUNNING",
    admin: ADMIN
  });
});

app.get("/get", async (req, res) => {
  const data = await fetchData();
  res.json(data);
});

app.get("/taixiumd5", async (req, res) => {
  const data = await fetchData();
  res.json(data);
});

// ===== START =====
app.listen(PORT, () => {
  console.log("🚀 Server VIP chạy tại port " + PORT);
});
