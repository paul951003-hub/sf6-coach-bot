const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --------------------
// MEMORY SYSTEM (簡單版，可升級DB)
// --------------------
const MEMORY_FILE = "./memory.json";

function loadMemory() {
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveMemory(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

// --------------------
// RULE LAYER (分析輔助)
// --------------------
function analyzeMessage(message) {
  const text = message.toLowerCase();

  let tags = [];

  if (text.includes("jp")) tags.push("zoning");
  if (text.includes("跳") || text.includes("anti")) tags.push("anti_air");
  if (text.includes("corner") || text.includes("被壓")) tags.push("corner_pressure");
  if (text.includes("combo")) tags.push("combo");

  return tags;
}

// --------------------
// AI LAYER (Gemini)
// --------------------
async function askAI(message, memory, tags) {
  const prompt = `
你是Street Fighter 6專業教練AI。

你必須：
- 分析問題本質
- 找出優先順序
- 提供具體訓練方法
- 用教練語氣，不要廢話

玩家歷史弱點：
${JSON.stringify(memory)}

系統標記：
${tags.join(", ")}

玩家輸入：
${message}

輸出格式：
1. 核心問題
2. 原因
3. 訓練方法（具體）
4. 下一步目標
`;

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      }
    );

    return (
      res.data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "AI無法分析"
    );
  } catch (err) {
    console.log("AI ERROR:", err.response?.data || err.message);
    return "AI暫時不可用";
  }
}

// --------------------
// WEBHOOK
// --------------------
app.post("/webhook", async (req, res) => {
  try {
    const event = req.body.events?.[0];
    if (!event || !event.message) return res.send("OK");
    if (event.message.type !== "text") return res.send("OK");

    const userId = event.source?.userId || "unknown";
    const userMessage = event.message.text;

    // load memory
    const memoryDB = loadMemory();

    if (!memoryDB[userId]) {
      memoryDB[userId] = {
        anti_air_fail: 0,
        corner_pressure: 0,
        zoning_issue: 0
      };
    }

    const memory = memoryDB[userId];

    // rule analysis
    const tags = analyzeMessage(userMessage);

    // update memory
    if (tags.includes("anti_air")) memory.anti_air_fail++;
    if (tags.includes("corner_pressure")) memory.corner_pressure++;
    if (tags.includes("zoning")) memory.zoning_issue++;

    saveMemory(memoryDB);

    // AI response
    const reply = await askAI(userMessage, memory, tags);

    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      {
        replyToken: event.replyToken,
        messages: [{ type: "text", text: reply }]
      },
      {
        headers: {
          Authorization: `Bearer ${LINE_TOKEN}`
        }
      }
    );

    res.send("OK");
  } catch (err) {
    console.log("WEBHOOK ERROR:", err.response?.data || err.message);
    res.send("OK");
  }
});

// --------------------
// HEALTH CHECK
// --------------------
app.get("/", (req, res) => {
  res.send("SF6 AI Coach running");
});

// --------------------
// START SERVER
// --------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SF6 AI Coach running on port " + PORT);
});
