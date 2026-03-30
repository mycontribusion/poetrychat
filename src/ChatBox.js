import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './ChatBox.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://poetrychat-s.onrender.com';
const POETRY_BOOK_NAME = "From Behind a Young Man's Chest: A poetry collection";

function ChatBox() {
    const [poemTitles, setPoemTitles] = useState([]);
    const [selectedPoem, setSelectedPoem] = useState('');
    const [userMessage, setUserMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [loadingPoemTitles, setLoadingPoemTitles] = useState(false);
    const [loadingAiResponse, setLoadingAiResponse] = useState(false);
    const [error, setError] = useState(null);
    const [inputError, setInputError] = useState('');
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('poetrychat-theme');
        if (saved) return saved;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    });

    const chatHistoryRef = useRef(null);
    const textareaRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Apply theme to <html>
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('poetrychat-theme', theme);
    }, [theme]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // Reset textarea height after sending
    useEffect(() => {
        if (!userMessage && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [userMessage]);

    // Fetch poem titles
    useEffect(() => {
        const fetchPoemTitles = async () => {
            try {
                setError(null);
                setLoadingPoemTitles(true);
                const response = await axios.get(`${BACKEND_URL}/api/poems`);
                setPoemTitles(response.data);
                if (response.data.length > 0) setSelectedPoem(response.data[0]);
            } catch (err) {
                console.error("Error fetching poem titles:", err);
                setError("Failed to load poem titles. Please refresh.");
            } finally {
                setLoadingPoemTitles(false);
            }
        };
        fetchPoemTitles();
    }, []);

    const sendRequestToAI = async (messagePrompt, existingMessageId = null) => {
        const messageId = existingMessageId || Date.now();

        // If it's a new message, add it to history with 'sending' status
        if (!existingMessageId) {
            setChatHistory(prev => [...prev, { id: messageId, type: 'user', text: messagePrompt, status: 'sending' }]);
        } else {
            // If it's a retry, update the status back to 'sending'
            setChatHistory(prev => prev.map(msg => msg.id === messageId ? { ...msg, status: 'sending' } : msg));
        }

        try {
            setError(null);
            setLoadingAiResponse(true);

            abortControllerRef.current = new AbortController();

            const recentHistory = chatHistory
                .filter(msg => msg.status === 'sent')
                .slice(-6)
                .map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'model',
                    text: msg.text
                }));

            const response = await axios.post(`${BACKEND_URL}/api/chat`, {
                message: messagePrompt,
                poemTitle: selectedPoem,
                history: recentHistory
            }, {
                signal: abortControllerRef.current.signal
            });

            // Mark user message as 'sent' and add AI reply
            setChatHistory(prev => {
                const updatedHistory = prev.map(msg => msg.id === messageId ? { ...msg, status: 'sent' } : msg);
                return [...updatedHistory, { id: Date.now() + 1, type: 'ai', text: response.data.reply, status: 'sent' }];
            });
        } catch (err) {
            if (axios.isCancel(err)) {
                setChatHistory(prev => prev.map(msg => msg.id === messageId ? { ...msg, status: 'failed', errorText: 'Stopped by user.' } : msg));
            } else {
                console.error("Error sending message:", err.response?.data || err.message);
                setChatHistory(prev => prev.map(msg => msg.id === messageId ? { ...msg, status: 'failed' } : msg));
            }
        } finally {
            setLoadingAiResponse(false);
            abortControllerRef.current = null;
        }
    };

    const stopRequest = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

    const retryMessage = async (messageId, text) => {
        await sendRequestToAI(text, messageId);
    };

    const sendMessage = async () => {
        setInputError('');
        if (!selectedPoem) { setInputError("Please select a poem."); return; }
        if (!userMessage.trim()) { setInputError("Please type a message."); return; }
        const msg = userMessage;
        setUserMessage('');
        await sendRequestToAI(msg);
    };

    const getPoemTextFromAI = async () => {
        setInputError('');
        if (!selectedPoem) { setInputError("Please select a poem first."); return; }
        await sendRequestToAI(`Please provide the full text of the poem: "${selectedPoem}".`);
    };

    const getSuggestedQuestionsFromAI = async () => {
        setInputError('');
        if (!selectedPoem) { setInputError("Please select a poem first."); return; }
        await sendRequestToAI(`Suggest some discussion questions about the poem: "${selectedPoem}".`);
    };

    const handleKeyDown = (e) => {
        // Desktop: Enter sends, Shift+Enter adds newline
        // Mobile: Enter adds newline natively
        if (e.key === 'Enter' && !e.shiftKey && !loadingAiResponse && !loadingPoemTitles) {
            // Check touch capability, screen width, or user agent to confidently detect mobile
            const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (!isMobile) {
                e.preventDefault();
                sendMessage();
            }
            // On mobile, do nothing and let the default newline behavior happen
        }
    };

    const handleMessageChange = (e) => {
        setUserMessage(e.target.value);
        setInputError('');
        // Auto-grow textarea up to 7 lines
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            const lineHeight = 24;
            const maxH = lineHeight * 7 + 24; // 7 lines + padding
            ta.style.height = Math.min(ta.scrollHeight, maxH) + 'px';
        }
    };

    const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

    return (
        <div className="app-shell">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />

            {/* ── Sidebar ── */}
            <aside className="sidebar">
                {/* Desktop-only: book identity */}
                <div className="sidebar-top">
                    <div className="book-icon" aria-hidden="true">
                        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="8" y="4" width="28" height="40" rx="3" fill="url(#bookGrad)" />
                            <rect x="10" y="6" width="24" height="36" rx="2" fill="rgba(255,255,255,0.08)" />
                            <line x1="14" y1="14" x2="30" y2="14" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="14" y1="19" x2="30" y2="19" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="14" y1="24" x2="24" y2="24" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
                            <rect x="6" y="4" width="4" height="40" rx="2" fill="url(#spineGrad)" />
                            <defs>
                                <linearGradient id="bookGrad" x1="8" y1="4" x2="36" y2="44" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#7c3aed" /><stop offset="1" stopColor="#4f46e5" />
                                </linearGradient>
                                <linearGradient id="spineGrad" x1="6" y1="4" x2="10" y2="44" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#5b21b6" /><stop offset="1" stopColor="#3730a3" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <h1 className="book-title">{POETRY_BOOK_NAME}</h1>
                    <p className="book-subtitle">An AI-powered poetry companion<br />by <strong>Ahmad Musa</strong></p>
                    <div className="title-ornament"><span />❧<span /></div>
                </div>

                {/* Poem selector */}
                <div className="sidebar-section">
                    <p className="sidebar-label">Select a Poem</p>
                    {loadingPoemTitles ? (
                        <p className="sidebar-loading">Loading poems…</p>
                    ) : (
                        <select
                            id="poem-select"
                            value={selectedPoem}
                            onChange={(e) => { setSelectedPoem(e.target.value); setInputError(''); }}
                            disabled={loadingPoemTitles || poemTitles.length === 0 || loadingAiResponse}
                            className="poem-select"
                        >
                            {poemTitles.length === 0
                                ? <option value="">No poems available</option>
                                : poemTitles.map(t => <option key={t} value={t}>{t}</option>)
                            }
                        </select>
                    )}
                </div>

                {error && <p className="sidebar-error">{error}</p>}
            </aside>

            {/* ── Chat Panel ── */}
            <main className="chat-panel">
                <header className="chat-header">
                    <div className="chat-header-title">
                        <span className="chat-header-dot" />
                        {selectedPoem ? <><span className="chat-header-label">Discussing:</span> <em>{selectedPoem}</em></> : 'Select a poem to begin'}
                    </div>
                    <div className="chat-header-right">
                        <div className="chat-header-badge">Poet AI</div>
                        <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                            {theme === 'dark' ? (
                                // Sun icon
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                </svg>
                            ) : (
                                // Moon icon
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div ref={chatHistoryRef} className="chat-history">
                    {chatHistory.length === 0 ? (
                        <div className="chat-empty">
                            <div className="chat-empty-icon">✦</div>
                            <p>Ask anything about <strong>{selectedPoem || 'the selected poem'}</strong></p>
                            <p className="chat-empty-hint">Use quick actions on the left or type your own question below.<br />Press <kbd>Shift+Enter</kbd> for a new line.</p>
                        </div>
                    ) : (
                        chatHistory.map((msg) => (
                            <div key={msg.id} className={`message-row ${msg.type} ${msg.status === 'failed' ? 'failed' : ''}`}>
                                <div className="avatar">{msg.type === 'user' ? 'You' : 'AI'}</div>
                                <div className={`message-bubble ${msg.type}`}>
                                    {msg.type === 'ai' && <span className="open-quote">"</span>}
                                    {msg.type === 'ai'
                                        ? <ReactMarkdown>{msg.text}</ReactMarkdown>
                                        : <p>{msg.text}</p>
                                    }
                                    {msg.status === 'failed' && (
                                        <div className="message-error-state">
                                            <span className="error-text">{msg.errorText || "Message failed to send."}</span>
                                            <button className="retry-btn" onClick={() => retryMessage(msg.id, msg.text)} disabled={loadingAiResponse}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="1 4 1 10 7 10"></polyline>
                                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                                                </svg>
                                                Retry
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    {loadingAiResponse && (
                        <div className="message-row ai">
                            <div className="avatar">AI</div>
                            <div className="message-bubble ai thinking">
                                <span className="dot" /><span className="dot" /><span className="dot" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <footer className="chat-footer">
                    {/* Quick actions moved above input */}
                    <div className="footer-quick-actions">
                        <button onClick={getPoemTextFromAI} disabled={loadingPoemTitles || loadingAiResponse || !selectedPoem} className="footer-action-btn">
                            <span className="btn-icon">📜</span> Get Poem Text
                        </button>
                        <button onClick={getSuggestedQuestionsFromAI} disabled={loadingPoemTitles || loadingAiResponse || !selectedPoem} className="footer-action-btn">
                            <span className="btn-icon">💡</span> Suggest Questions
                        </button>
                    </div>

                    {inputError && <p className="input-error">{inputError}</p>}
                    <div className="input-row">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={userMessage}
                            onChange={handleMessageChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about the poem… (Shift+Enter for new line)"
                            disabled={loadingPoemTitles || loadingAiResponse || !selectedPoem}
                            className="message-input"
                        />
                        {loadingAiResponse ? (
                            <button
                                onClick={stopRequest}
                                className="send-button stop-button"
                                title="Stop generating"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                            </button>
                        ) : (
                            <button
                                onClick={sendMessage}
                                disabled={loadingPoemTitles || !selectedPoem || !userMessage.trim()}
                                className="send-button"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </button>
                        )}
                    </div>
                </footer>
            </main>
        </div>
    );
}

export default ChatBox;
