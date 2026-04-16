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
const getTaiXiu = v => (v >= 11 ? "TÀI" : "XỈU");

// ===== MARKOV =====
function markovPredict(arr) {
  if (!arr || arr.length < 3)
    return { predict: "ĐANG PHÂN TÍCH", confidence: "0%" };

  let map = {};

  for (let i = 0; i < arr.length - 1; i++) {
    let a = arr[i];
    let b = arr[i + 1];
    if (!map[a]) map[a] = {};
    map[a][b] = (map[a][b] || 0) + 1;
  }

  let last = arr[arr.length - 1];
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

// ===== PATTERN =====
function analyzePattern(results) {
  let tx = results.map(getTaiXiu);

  let pattern = { type: "NONE", streak: 0 };

  if (tx.length < 3) return { tx, pattern };

  let last = tx[tx.length - 1];
  let streak = 1;

  for (let i = tx.length - 2; i >= 0; i--) {
    if (tx[i] === last) streak++;
    else break;
  }

  if (streak >= 3) pattern = { type: "CẦU BỆT", streak };

  let last3 = tx.slice(-3).join("-");
  if (last3 === "TÀI-TÀI-XỈU" || last3 === "XỈU-XỈU-TÀI") {
    pattern = { type: "CẦU 2-1", streak: 3 };
  }

  return { tx, pattern };
}

// ===== AI =====
function evaluate(pattern, markov) {
  let score = 0;

  if (pattern.type !== "NONE") score += 40;
  if (pattern.streak >= 3) score += 30;
  if (markov.confidence !== "0%") score += 30;

  if (score >= 80) return "🔥 TỶ LỆ CAO";
  if (score >= 50) return "⚠️ CÂN NHẮC";
  return "❌ RỦI RO";
}

// ===== FETCH =====
async function fetchData() {
  const now = Date.now();
  if (cache && now - lastFetch < FETCH_INTERVAL) return cache;

  try {
    const res = await axios.get(API_URL, { timeout: 10000 });
    let data = res.data;

    // ===== AUTO FIX FORMAT =====
    let list = [];
    if (Array.isArray(data)) list = data;
    else if (Array.isArray(data?.data)) list = data.data;
    else if (Array.isArray(data?.result)) list = data.result;
    else if (Array.isArray(data?.items)) list = data.items;

    if (!list.length && cache) return cache;

    if (!list.length) {
      return {
        admin: ADMIN,
        error: "API CHƯA CÓ DỮ LIỆU",
        time: new Date().toLocaleString("vi-VN")
      };
    }

    const latest = list[0];

    const session =
      latest.sessionId ||
      latest.SessionId ||
      latest.id ||
      Date.now();

    if (session === lastSessionId) return cache;

    lastSessionId = session;
    lastFetch = now;

    // ===== MAP =====
    const results = list
      .map(x => Number(x.total || x.DiceSum || x.sum))
      .filter(x => !isNaN(x));

    const analysis = analyzePattern(results);
    const markov = markovPredict(analysis.tx);

    // ===== DATA =====
    const x1 = latest.FirstDice || latest.firstDice || 0;
    const x2 = latest.SecondDice || latest.secondDice || 0;
    const x3 = latest.ThirdDice || latest.thirdDice || 0;

    const sum = latest.DiceSum || latest.total || x1 + x2 + x3;

    const ketqua = getTaiXiu(sum);
    const next = Number(session) + 1;

    const tin_cay = {
      TÀI: markov.predict === "TÀI" ? markov.confidence : "50%",
      XỈU: markov.predict === "XỈU" ? markov.confidence : "50%"
    };

    cache = {
      admin: ADMIN,
      phien: session,

      xuc_xac_1: x1,
      xuc_xac_2: x2,
      xuc_xac_3: x3,

      tong: sum,
      ket_qua: ketqua,

      phien_tiep_theo: next,

      du_doan: markov.predict,
      do_tin_cay: tin_cay,

      danh_gia: evaluate(analysis.pattern, markov),

      ly_do: `Markov | ${analysis.pattern.type} | Cầu ${analysis.pattern.streak}`,

      pattern: analysis.pattern.type,

      time: new Date().toLocaleString("vi-VN"),

      original: data
    };

    return cache;

  } catch (err) {
    return cache || {
      admin: ADMIN,
      error: "API TẠM LỖI - ĐANG DÙNG CACHE",
      time: new Date().toLocaleString("vi-VN")
    };
  }
}

// ===== ROUTES =====
app.get("/", (req, res) => {
  res.json({ status: "MA789 VIP RUNNING", admin: ADMIN });
});

app.get("/get", async (req, res) => {
  res.json(await fetchData());
});

app.get("/taixiumd5", async (req, res) => {
  res.json(await fetchData());
});

app.get("/predict", async (req, res) => {
  res.json(await fetchData());
});

// ===== START =====
app.listen(PORT, () => {
  console.log("🔥 MA789 VIP RUNNING PORT " + PORT);
});
