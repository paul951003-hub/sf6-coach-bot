const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ✅ 從 Render 環境變數拿（安全）
const LINE_TOKEN = process.env.LINE_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🧠 AI教練
async function askAI(message) {
  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
你是SF6（快打旋風6）專業教練AI。

規則：
- 用教練語氣
- 只講重點
- 每次只抓1個核心問題
- 提供可執行訓練
- 像職業教練一樣直接

輸出格式：
1. 問題判斷
2. 為什麼
3. 訓練方法
4. 下一步
`
          },
          { role: "user", content: message }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.data.choices[0].message.content;
  } catch (err) {
    console.log("AI ERROR:", err.response?.data || err.message);
    return "AI暫時出問題，請稍後再試";
  }
}

// 📱 LINE webhook
app.post("/webhook", async (req, res) => {
  try {
    const event = req.body.events?.[0];

    if (!event || !event.message) {
      return res.send("OK");
    }

    const userMessage = event.message.text;

    const reply = await askAI(userMessage);

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
    console.log("WEBHOOK ERROR:", err.message);
    res.send("OK");
  }
});

// 🚀 port（Render 必須這樣寫）
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SF6 Coach running on port " + PORT);
});
