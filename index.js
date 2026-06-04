const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function askAI(message) {
  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a Street Fighter 6 coach. Give short, practical coaching advice."
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
    console.log("AI error:", err.response?.data || err.message);
    return "AI error";
  }
}

app.post("/webhook", async (req, res) => {
  try {
    const event = req.body.events?.[0];
    if (!event || !event.message) return res.send("OK");

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
    console.log("Webhook error:", err.message);
    res.send("OK");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
