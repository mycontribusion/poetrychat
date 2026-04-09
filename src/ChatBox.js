import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './ChatBox.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : 'https://poetrychat-s.onrender.com');
const POETRY_BOOK_NAME = "From Behind a Young Man's Chest: A poetry collection";

const SUGGESTED_QUESTIONS = [
    "What is the main theme?",
    "Line-by-line breakdown",
    "Analyze emotions",
    "Analyse the tone.",
    "Analyse the structure.",
    "Deep analysis",
    "Suggest 9 advanced linguistic questions"
];

function ChatBox() {
    const [poemData, setPoemData] = useState([]);
    const [selectedPoem, setSelectedPoem] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [userMessage, setUserMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [loadingPoemTitles, setLoadingPoemTitles] = useState(false);
    const [loadingAiResponse, setLoadingAiResponse] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
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

    // Scroll to bottom when user sends a message or while AI is thinking. 
    // We intentionally do NOT scroll when the AI's final answer arrives so you can read it from the top down.
    useEffect(() => {
        if (chatHistoryRef.current) {
            const lastMsg = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
            if (loadingAiResponse || (lastMsg && lastMsg.type === 'user')) {
                chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
            }
        }
    }, [chatHistory, loadingAiResponse]);

    // Reset textarea height after sending
    useEffect(() => {
        if (!userMessage && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [userMessage]);

    // Fetch poem titles
    useEffect(() => {
        const fetchPoemTitles = async () => {
            console.log("Attempting to fetch poems from:", BACKEND_URL);
            try {
                setError(null);
                setLoadingPoemTitles(true);
                const response = await axios.get(`${BACKEND_URL}/api/poems`);
                console.log("Poem titles fetched successfully:", response.data.length, "poems found.");
                setPoemData(response.data);
                if (response.data.length > 0) setSelectedPoem(response.data[0].title);
            } catch (err) {
                console.error("Detailed error fetching poem titles:", {
                    message: err.message,
                    code: err.code,
                    response: err.response?.data,
                    status: err.response?.status,
                    url: `${BACKEND_URL}/api/poems`
                });
                setError(`Failed to load poem titles. (URL: ${BACKEND_URL}, Error: ${err.message})`);
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
            setChatHistory(prev => [...prev, {
                id: messageId,
                type: 'user',
                text: messagePrompt,
                status: 'sending',
                poemContext: selectedPoem
            }]);
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
                return [...updatedHistory, {
                    id: Date.now() + 1,
                    type: 'ai',
                    text: response.data.reply,
                    status: 'sent',
                    poemContext: selectedPoem
                }];
            });
        } catch (err) {
            if (axios.isCancel(err)) {
                setChatHistory(prev => prev.map(msg => msg.id === messageId ? { ...msg, status: 'failed', errorText: 'Stopped by user.' } : msg));
            } else {
                console.error("Error sending message:", err.response?.data || err.message);
                const errorData = err.response?.data;
                const specificError = errorData?.details || (typeof errorData?.error === 'string' ? errorData.error : null) || "Message failed to send.";
                setChatHistory(prev => prev.map(msg => msg.id === messageId ? { ...msg, status: 'failed', errorText: specificError } : msg));
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

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    };

    const sendMessage = async () => {
        setInputError('');
        if (!selectedPoem) { setInputError("Please select a poem."); return; }
        if (!userMessage.trim()) { setInputError("Please type a message."); return; }
        const msg = userMessage;
        setUserMessage('');
        await sendRequestToAI(msg);
    };

    // Auto-fetch poem text when selectedPoem changes
    useEffect(() => {
        if (selectedPoem && poemData.length > 0) {
            // Check if we already just fetched this poem to avoid loops 
            // (though selectedPoem changing is the primary trigger)
            const alreadyFetched = chatHistory.some(msg =>
                msg.poemContext === selectedPoem &&
                msg.text.includes(`Please provide the full text of the poem: "${selectedPoem}"`)
            );
            if (!alreadyFetched) {
                sendRequestToAI(`Please provide the full text of the poem: "${selectedPoem}".`);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPoem, poemData.length]);

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

    const filteredPoems = poemData.filter(p => {
        const titleStr = typeof p === 'string' ? p : (p?.title || '');
        const bodyStr = typeof p === 'string' ? '' : (p?.body || '');
        const q = searchQuery.toLowerCase();
        return titleStr.toLowerCase().includes(q) || bodyStr.toLowerCase().includes(q);
    });

    return (
        <div className="app-shell">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />

            {/* ── Sidebar ── */}
            <aside className="sidebar">
                {/* Desktop-only: book identity */}
                <div className="sidebar-top">
                    <div className="book-cover-container">
                        <img src="/book-cover.jpg" alt="Book Cover" className="book-cover-image" />
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
                        <div className="poem-selector-container">
                            <div className="poem-search-wrapper">
                                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search poems..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="poem-search-input"
                                    disabled={poemData.length === 0 || loadingAiResponse}
                                />
                            </div>
                            <div className="poem-selector-actions">
                                <select
                                    id="poem-select"
                                    value={selectedPoem}
                                    onChange={(e) => { setSelectedPoem(e.target.value); setInputError(''); }}
                                    disabled={poemData.length === 0 || loadingAiResponse}
                                    className="poem-select"
                                >
                                    {filteredPoems.length === 0
                                        ? <option value="">No matches found</option>
                                        : filteredPoems.map(p => {
                                            const title = typeof p === 'string' ? p : (p?.title || 'Unknown');
                                            return <option key={title} value={title}>{title}</option>;
                                        })
                                    }
                                </select>
                                <button
                                    className="poem-load-btn"
                                    onClick={() => selectedPoem && sendRequestToAI(`Please provide the full text of the poem: "${selectedPoem}".`)}
                                    disabled={!selectedPoem || loadingAiResponse}
                                    title="Load/Refresh Poem Text"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24"></path>
                                        <polyline points="21 3 21 9 15 9"></polyline>
                                    </svg>
                                </button>
                            </div>
                        </div>
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
                            <p className="chat-empty-hint">Use quick actions above the input or type your own question below.</p>
                        </div>
                    ) : (
                        chatHistory.map((msg, index) => {
                            const prevMsg = index > 0 ? chatHistory[index - 1] : null;
                            // Show divider if poemContext exists and it's different from the previous message
                            const showPoemContext = msg.poemContext && (!prevMsg || prevMsg.poemContext !== msg.poemContext);

                            return (
                                <React.Fragment key={msg.id}>
                                    {showPoemContext && (
                                        <div className="chat-poem-divider">
                                            <span>Discussing: <strong>{msg.poemContext}</strong></span>
                                        </div>
                                    )}
                                    <div className={`message-row ${msg.type} ${msg.status === 'failed' ? 'failed' : ''}`}>
                                        <div className="avatar">{msg.type === 'user' ? 'You' : 'AI'}</div>
                                        <div className={`message-bubble ${msg.type}`}>
                                            {msg.type === 'ai' && <span className="open-quote">"</span>}
                                            {msg.type === 'ai'
                                                ? <ReactMarkdown>{msg.text}</ReactMarkdown>
                                                : <p>{msg.text}</p>
                                            }
                                            <button
                                                className={`copy-button ${copiedId === msg.id ? 'copied' : ''}`}
                                                onClick={() => copyToClipboard(msg.text, msg.id)}
                                                title="Copy to clipboard"
                                                aria-label="Copy message"
                                            >
                                                {copiedId === msg.id ? (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                    </svg>
                                                ) : (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                    </svg>
                                                )}
                                            </button>
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
                                </React.Fragment>
                            );
                        })
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

                    {inputError && <p className="input-error">{inputError}</p>}

                    {/* Suggestive Questions */}
                    <div className="suggested-questions-row">
                        {SUGGESTED_QUESTIONS.map((q, idx) => (
                            <button
                                key={idx}
                                className="suggested-question-btn"
                                onClick={() => {
                                    setUserMessage(q);
                                    // Small delay to ensure state update if we were to send immediately,
                                    // but user asked for "directly be asked", so I'll send it.
                                    sendRequestToAI(q);
                                    setUserMessage('');
                                }}
                                disabled={loadingAiResponse || !selectedPoem}
                            >
                                {q}
                            </button>
                        ))}
                    </div>

                    <div className="input-row">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={userMessage}
                            onChange={handleMessageChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about the poem…"
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
