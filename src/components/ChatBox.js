import React, { useState } from "react";
import axios from "axios";
import { marked } from "marked";
import "./ChatBox.css";

function ChatBox({ poemTitle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { sender: "user", text: input }];
    setMessages(newMessages);
    setInput("");

    try {
      const response = await axios.post("https://poetrychat-s.onrender.com", {
        prompt: input,
        poemTitle: poemTitle || "",
      });

      const aiReply = response?.data?.response || "⚠️ No response from AI.";

      setMessages([...newMessages, { sender: "ai", text: aiReply }]);
    } catch (err) {
      console.error("❌ AI error:", err?.response?.data || err.message || err);
      setMessages([
        ...newMessages,
        {
          sender: "ai",
          text: "**Error:** Something went wrong while contacting the AI.",
        },
      ]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chatbox">
      <div className="messages">
        {messages.map((msg, index) =>
          msg?.text ? (
            <div
              key={index}
              className={`message ${msg.sender}`}
              dangerouslySetInnerHTML={{
                __html:
                  msg.sender === "ai"
                    ? marked.parse(msg.text || "")
                    : marked.parseInline(msg.text || ""),
              }}
            ></div>
          ) : null
        )}
      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Ask something about the poem..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default ChatBox;
