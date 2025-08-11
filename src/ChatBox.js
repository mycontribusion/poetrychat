import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './ChatBox.css'; // Make sure this CSS file is in the same directory!

// Define your backend URL
const BACKEND_URL = 'https://poetrychat-s.onrender.com'; // Ensure this is your deployed Render URL

const POETRY_BOOK_NAME = "- From Behind A Young Man's Chest";

function ChatBox() {
    const [poemTitles, setPoemTitles] = useState([]);
    const [selectedPoem, setSelectedPoem] = useState('');
    const [userMessage, setUserMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [loadingPoemTitles, setLoadingPoemTitles] = useState(false);
    const [loadingAiResponse, setLoadingAiResponse] = useState(false);
    const [error, setError] = useState(null);
    const [inputError, setInputError] = useState('');

    const chatHistoryRef = useRef(null);

    // Scroll to the bottom of the chat history when it updates
    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // Fetch poem titles on component mount
    useEffect(() => {
        const fetchPoemTitles = async () => {
            try {
                setError(null);
                setLoadingPoemTitles(true);
                const response = await axios.get(`${BACKEND_URL}/api/poems`);
                setPoemTitles(response.data);
                if (response.data.length > 0) {
                    setSelectedPoem(response.data[0]);
                }
            } catch (err) {
                console.error("Error fetching poem titles:", err);
                setError("Failed to load poem titles. Please refresh the page.");
            } finally {
                setLoadingPoemTitles(false);
            }
        };

        fetchPoemTitles();
    }, []);

    const sendRequestToAI = async (messagePrompt) => {
        // Add user-initiated request to chat history
        setChatHistory(prevHistory => [...prevHistory, { type: 'user', text: messagePrompt }]);

        try {
            setError(null);
            setLoadingAiResponse(true);

            const response = await axios.post(`${BACKEND_URL}/api/chat`, {
                message: messagePrompt,
                poemTitle: selectedPoem,
            });

            const aiReply = response.data.reply;

            setChatHistory(prevHistory => [...prevHistory, { type: 'ai', text: aiReply }]);

        } catch (err) {
            console.error("Error sending message to AI:", err.response?.data || err.message);
            setError("Failed to get AI response. Please try again.");
            // Optionally remove the last user message if AI response fails
            setChatHistory(prevHistory => prevHistory.slice(0, prevHistory.length - 1));
        } finally {
            setLoadingAiResponse(false);
        }
    };

    const sendMessage = async () => {
        // Clear previous input errors
        setInputError('');

        if (!selectedPoem) {
            setInputError("Please select a poem.");
            return;
        }
        if (!userMessage.trim()) {
            setInputError("Please type a message.");
            return;
        }

        const messageToSend = userMessage;
        setUserMessage(''); // Clear input field immediately

        await sendRequestToAI(messageToSend);
    };

    const getPoemTextFromAI = async () => {
        setInputError('');
        if (!selectedPoem) {
            setInputError("Please select a poem first.");
            return;
        }
        // Removed the explicit markdown code block instruction from the frontend prompt
        await sendRequestToAI(`Please provide the full text of the poem: "${selectedPoem}".`);
    };

    const getSuggestedQuestionsFromAI = async () => {
        setInputError('');
        if (!selectedPoem) {
            setInputError("Please select a poem first.");
            return;
        }
        await sendRequestToAI(`Suggest some discussion questions about the poem: "${selectedPoem}".`);
    };


    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !loadingAiResponse && !loadingPoemTitles) {
            sendMessage();
        }
    };

    return (
        <div className="chatbox-container">
            <h2 className="chatbox-heading">
                Chat about <span className="poetry-book-name">{POETRY_BOOK_NAME}</span>
            </h2>

            {/* Loading and Error Messages */}
            {loadingPoemTitles && <p className="chatbox-message-center loading-message">Loading poems...</p>}
            {error && <p className="chatbox-message-center error-message">{error}</p>}

            {/* Poem Selection */}
            <div className="poem-selection-group">
                <label htmlFor="poem-select" className="poem-selection-label">
                    Select a Poem:
                </label>
                <select
                    id="poem-select"
                    value={selectedPoem}
                    onChange={(e) => {
                        setSelectedPoem(e.target.value);
                        setInputError(''); // Clear input error when poem changes
                    }}
                    disabled={loadingPoemTitles || poemTitles.length === 0 || loadingAiResponse}
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
                            <div className={`message-bubble ${msg.type}`}>
                                <strong className="message-sender">
                                    {msg.type === 'user' ? 'You:' : 'Poet AI:'}
                                </strong>
                                {msg.type === 'ai' ? (
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                ) : (
                                    <p>{msg.text}</p>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {loadingAiResponse && (
                    <div className="chat-message ai">
                        <div className="message-bubble ai">
                            <strong className="message-sender">Poet AI:</strong>
                            <span className="typing-indicator"> Thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Error Message */}
            {inputError && <p className="input-error-message">{inputError}</p>}

            {/* Message Input Area and Action Buttons */}
            <div className="action-buttons-container">
                <button
                    onClick={getPoemTextFromAI}
                    disabled={loadingPoemTitles || loadingAiResponse || !selectedPoem}
                    className="action-button get-poem-text-button"
                >
                    {loadingAiResponse && chatHistory[chatHistory.length -1]?.text.includes("Provide the full text") ? 'Getting Text...' : 'Get Poem Text'}
                </button>
                <button
                    onClick={getSuggestedQuestionsFromAI}
                    disabled={loadingPoemTitles || loadingAiResponse || !selectedPoem}
                    className="action-button suggest-questions-button"
                >
                     {loadingAiResponse && chatHistory[chatHistory.length -1]?.text.includes("Suggest questions") ? 'Suggesting...' : 'Suggest Questions'}
                </button>
            </div>
            <div className="message-input-area">
                <input
                    type="text"
                    value={userMessage}
                    onChange={(e) => {
                        setUserMessage(e.target.value);
                        setInputError(''); // Clear error on typing
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about the poem..."
                    disabled={loadingPoemTitles || loadingAiResponse || !selectedPoem}
                    className="message-input"
                />
                <button
                    onClick={sendMessage}
                    disabled={loadingPoemTitles || loadingAiResponse || !selectedPoem || !userMessage.trim()}
                    className="send-button"
                >
                    {loadingAiResponse && !chatHistory[chatHistory.length -1]?.text.includes("Provide the full text") && !chatHistory[chatHistory.length -1]?.text.includes("Suggest questions") ? 'Sending...' : 'Send'}
                </button>
            </div>
        </div>
    );
}

export default ChatBox;
