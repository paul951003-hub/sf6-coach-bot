const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ENV
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LINE_TOKEN = process.env.LINE_TOKEN;

// AI
async function askAI(message) {
  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a Street Fighter 6 coach. Give short, practical advice."
          },
          {
            role: "user",
            content: message
          }
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
    console.log("OPENAI ERROR:", err.response?.data || err.message);
    return "AI error";
  }
}

// webhook
app.post("/webhook", async (req, res) => {
  try {
    console.log("WEBHOOK RECEIVED");

    const event = req.body.events?.[0];
    if (!event || event.message.type !== "text") {
      return res.send("OK");
    }

    const userMessage = event.message.text;
    console.log("USER:", userMessage);

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

    console.log("REPLY SENT");

    res.send("OK");
  } catch (err) {
    console.log("WEBHOOK ERROR:", err.response?.data || err.message);
    res.send("OK");
  }
});

// health check
app.get("/", (req, res) => {
  res.send("SF6 Coach running");
});

// port
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
