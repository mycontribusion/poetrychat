import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './ChatBox.css'; // Import the new CSS file

// Define your backend URL
const BACKEND_URL = 'https://poetrychat-s.onrender.com'; // Ensure this is your deployed Render URL https://poetrychat-s.onrender.com http://localhost:5000

const POETRY_BOOK_NAME = "From Behind A Young Man's Chest";

function ChatBox() {
    const [poemTitles, setPoemTitles] = useState([]);
    const [selectedPoem, setSelectedPoem] = useState('');
    const [userMessage, setUserMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const chatHistoryRef = useRef(null);

    // Modified useEffect for improved scrolling behavior
    useEffect(() => {
        if (chatHistoryRef.current) {
            // Scroll into view the last message, ensuring its start is visible
            const lastMessageElement = chatHistoryRef.current.lastElementChild;
            if (lastMessageElement) {
                lastMessageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }
    }, [chatHistory]); // Dependency on chatHistory

    useEffect(() => {
        const fetchPoemTitles = async () => {
            try {
                setError(null);
                setLoading(true);
                const response = await axios.get(`${BACKEND_URL}/api/poems`);
                setPoemTitles(response.data);
                if (response.data.length > 0) {
                    setSelectedPoem(response.data[0]);
                }
            } catch (err) {
                console.error("Error fetching poem titles:", err);
                setError("Failed to load poem titles. Please check backend.");
            } finally {
                setLoading(false);
            }
        };

        fetchPoemTitles();
    }, []);

    const sendMessage = async () => {
        if (!userMessage.trim() || !selectedPoem) {
            alert("Please select a poem and type a message.");
            return;
        }

        const messageToSend = userMessage;

        setChatHistory(prevHistory => [...prevHistory, { type: 'user', text: messageToSend }]);

        try {
            setError(null);
            setLoading(true);

            const response = await axios.post(`${BACKEND_URL}/api/chat`, {
                message: messageToSend,
                poemTitle: selectedPoem,
            });

            const aiReply = response.data.reply;

            setChatHistory(prevHistory => [...prevHistory, { type: 'ai', text: aiReply }]);
            setUserMessage('');

        } catch (err) {
            console.error("Error sending message to AI:", err.response?.data || err.message);
            setError("Failed to get AI response. Please try again. Check backend console for details.");
            setChatHistory(prevHistory => prevHistory.slice(0, prevHistory.length - 1));
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !loading) {
            sendMessage();
        }
    };

    return (
        <div className="chatbox-container">
            <h2 className="chatbox-heading">
                Chat about {POETRY_BOOK_NAME}
            </h2>

            {loading && <p className="chatbox-message-center chatbox-loading">Loading...</p>}
            {error && <p className="chatbox-message-center chatbox-error">Error: {error}</p>}

            {/* Poem Selection */}
            <div className="poem-selection-group">
                <label htmlFor="poem-select" className="poem-selection-label">
                    Select a Poem:
                </label>
                <select
                    id="poem-select"
                    value={selectedPoem}
                    onChange={(e) => setSelectedPoem(e.target.value)}
                    disabled={loading || poemTitles.length === 0}
                    className="poem-select"
                >
                    {poemTitles.length === 0 ? (
                        <option value="">No poems available</option>
                    ) : (
                        poemTitles.map(title => (
                            <option key={title} value={title}>{title}</option>
                        ))
                    )}
                </select>
            </div>

            {/* Chat History Display */}
            <div
                ref={chatHistoryRef}
                className="chat-history-display"
            >
                {chatHistory.length === 0 ? (
                    <p className="chat-history-empty-message">Start a conversation about the selected poem!</p>
                ) : (
                    chatHistory.map((msg, index) => (
                        <div
                            key={index}
                            className={`chat-message ${msg.type}`}
                        >
                            <strong className={`chat-message-sender ${msg.type}`}>
                                {msg.type === 'user' ? 'You:' : 'Poet AI:'}
                            </strong>
                            {msg.type === 'ai' ? (
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            ) : (
                                msg.text
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Message Input */}
            <div className="message-input-area">
                <input
                    type="text"
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about the poem..."
                    disabled={loading || !selectedPoem}
                    className="message-input"
                />
                <button
                    onClick={sendMessage}
                    disabled={loading || !selectedPoem || !userMessage.trim()}
                    className="send-button"
                >
                    {loading ? 'Sending...' : 'Send'}
                </button>
            </div>
        </div>
    );
}

export default ChatBox;
