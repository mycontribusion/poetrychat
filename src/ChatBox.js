// src/ChatBox.js
import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Import axios for making HTTP requests

// Define your backend URL
const BACKEND_URL = 'http://localhost:5000'; // IMPORTANT: Make sure this matches your Node.js server port

function ChatBox() {
    const [poemTitles, setPoemTitles] = useState([]); // State to store fetched poem titles
    const [selectedPoem, setSelectedPoem] = useState(''); // State for the currently selected poem title
    const [userMessage, setUserMessage] = useState(''); // State for the user's input message
    const [chatHistory, setChatHistory] = useState([]); // State to store chat messages
    const [loading, setLoading] = useState(false); // State for loading indicator
    const [error, setError] = useState(null); // State for error messages

    // useEffect to fetch poem titles when the component mounts
    useEffect(() => {
        const fetchPoemTitles = async () => {
            try {
                setError(null); // Clear previous errors
                setLoading(true); // Set loading state
                // Your backend's route for poem titles is /api/poems
                const response = await axios.get(`${BACKEND_URL}/api/poems`);
                setPoemTitles(response.data); // Assuming backend sends an array directly
                if (response.data.length > 0) {
                    setSelectedPoem(response.data[0]); // Automatically select the first poem
                }
            } catch (err) {
                console.error("Error fetching poem titles:", err);
                setError("Failed to load poem titles. Please check if backend is running and accessible.");
            } finally {
                setLoading(false); // Reset loading state
            }
        };

        fetchPoemTitles();
    }, []); // Empty dependency array means this runs once on mount

    // Function to send message to backend and get AI reply
    const sendMessage = async () => {
        if (!userMessage.trim() || !selectedPoem) {
            alert("Please select a poem and type a message.");
            return;
        }

        const newUserMessage = userMessage;
        setUserMessage(''); // Clear input field immediately

        // Add user's message to chat history
        setChatHistory(prevHistory => [...prevHistory, { type: 'user', text: newUserMessage }]);

        try {
            setError(null); // Clear previous errors
            setLoading(true); // Set loading state

            // Your backend's chat route is /api/chat
            const response = await axios.post(`${BACKEND_URL}/api/chat`, {
                message: newUserMessage, // Backend expects 'message'
                poemTitle: selectedPoem, // Backend expects 'poemTitle'
            });

            const aiReply = response.data.reply; // Backend sends response in 'reply' field

            // Add AI's reply to chat history
            setChatHistory(prevHistory => [...prevHistory, { type: 'ai', text: aiReply }]);

        } catch (err) {
            console.error("Error sending message to AI:", err.response?.data || err.message);
            setError("Failed to get AI response. Please try again. Check backend console for details.");
            // Optionally add the user message back if AI failed
            setChatHistory(prevHistory => prevHistory.slice(0, prevHistory.length - 1));
        } finally {
            setLoading(false); // Reset loading state
        }
    };

    // Handle Enter key press in the input field
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !loading) {
            sendMessage();
        }
    };

    return (
        <div style={{
            fontFamily: 'Arial, sans-serif',
            maxWidth: '800px',
            margin: '20px auto',
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            backgroundColor: '#fff',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 'calc(100vh - 40px)' // Adjust based on body/root padding
        }}>
            <h2 style={{ textAlign: 'center', color: '#333', marginBottom: '20px' }}>Chat with the Poet AI</h2>

            {loading && <p style={{ textAlign: 'center', color: '#007bff' }}>Loading...</p>}
            {error && <p style={{ textAlign: 'center', color: '#f44336' }}>Error: {error}</p>}

            {/* Poem Selection */}
            <div style={{ marginBottom: '20px' }}>
                <label htmlFor="poem-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    Select a Poem:
                </label>
                <select
                    id="poem-select"
                    value={selectedPoem}
                    onChange={(e) => setSelectedPoem(e.target.value)}
                    disabled={loading || poemTitles.length === 0}
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '5px',
                        border: '1px solid #ccc',
                        fontSize: '1em'
                    }}
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
            <div style={{
                border: '1px solid #eee',
                borderRadius: '5px',
                padding: '15px',
                minHeight: '250px',
                maxHeight: '400px',
                overflowY: 'auto',
                marginBottom: '20px',
                backgroundColor: '#f9f9f9',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}>
                {chatHistory.length === 0 ? (
                    <p style={{ color: '#888', textAlign: 'center', margin: 'auto' }}>Start a conversation about the selected poem!</p>
                ) : (
                    chatHistory.map((msg, index) => (
                        <div
                            key={index}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '15px',
                                maxWidth: '80%',
                                // Use flexbox alignment for messages
                                alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                                backgroundColor: msg.type === 'user' ? '#e0f7fa' : '#f0f0f0',
                                border: msg.type === 'user' ? '1px solid #b2ebf2' : '1px solid #e0e0e0',
                                wordWrap: 'break-word'
                            }}
                        >
                            <strong style={{ color: msg.type === 'user' ? '#00796b' : '#333' }}>
                                {msg.type === 'user' ? 'You:' : 'Poet AI:'}
                            </strong> {msg.text}
                        </div>
                    ))
                )}
            </div>

            {/* Message Input */}
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}> {/* Push to bottom */}
                <input
                    type="text"
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about the poem..."
                    disabled={loading || !selectedPoem}
                    style={{
                        flexGrow: 1,
                        padding: '10px',
                        borderRadius: '5px',
                        border: '1px solid #ccc',
                        fontSize: '1em'
                    }}
                />
                <button
                    onClick={sendMessage}
                    disabled={loading || !selectedPoem || !userMessage.trim()}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '5px',
                        border: 'none',
                        backgroundColor: '#007bff',
                        color: 'white',
                        fontSize: '1em',
                        cursor: 'pointer',
                        opacity: (loading || !selectedPoem || !userMessage.trim()) ? 0.6 : 1
                    }}
                >
                    {loading ? 'Sending...' : 'Send'}
                </button>
            </div>
        </div>
    );
}

export default ChatBox;