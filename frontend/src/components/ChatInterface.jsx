import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

// Defined outside component so it's stable (no re-creation on render)
const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-3.5-turbo',
    keyPlaceholder: 'Enter your OpenAI API key (sk-...)',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    color: 'bg-green-500'
  },
  groq: {
    name: 'Groq',
    models: ['llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    defaultModel: 'llama-3.1-8b-instant',
    keyPlaceholder: 'Enter your Groq API key (gsk_...)',
    getKeyUrl: 'https://console.groq.com/keys',
    color: 'bg-orange-500'
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
    defaultModel: 'gemini-1.5-flash',
    keyPlaceholder: 'Enter your Google AI API key (AI...)',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    color: 'bg-blue-500'
  }
};

const ChatInterface = () => {
  const [provider, setProvider] = useState(() => localStorage.getItem('user_ai_provider') || 'openai');
  const [model, setModel] = useState(() => {
    const savedProvider = localStorage.getItem('user_ai_provider') || 'openai';
    return localStorage.getItem(`user_ai_model_${savedProvider}`) || PROVIDERS[savedProvider].defaultModel;
  });
  // Each provider stores its own key: user_api_key_openai, user_api_key_groq, etc.
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(`user_api_key_${localStorage.getItem('user_ai_provider') || 'openai'}`) || '');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const messagesEndRef = useRef(null);

  // When provider changes: load that provider's saved key + model
  useEffect(() => {
    localStorage.setItem('user_ai_provider', provider);
    const savedKey = localStorage.getItem(`user_api_key_${provider}`) || '';
    const savedModel = localStorage.getItem(`user_ai_model_${provider}`) || PROVIDERS[provider].defaultModel;
    setApiKey(savedKey);
    setModel(savedModel);
    setError('');
  }, [provider]);

  // Save API key per provider
  useEffect(() => {
    localStorage.setItem(`user_api_key_${provider}`, apiKey);
  }, [apiKey, provider]);

  // Save model per provider
  useEffect(() => {
    localStorage.setItem(`user_ai_model_${provider}`, model);
  }, [model, provider]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      setError(`Please enter your ${PROVIDERS[provider].name} API key first.`);
      return;
    }
    if (!message.trim()) {
      setError('Please enter a message.');
      return;
    }

    setIsLoading(true);
    setError('');

    const userMessage = { role: 'user', content: message.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    const currentMessage = message.trim();
    setMessage('');

    try {
      const response = await api.post(
        '/chat',
        { message: currentMessage, provider, model, maxTokens: 500, temperature: 0.7 },
        { headers: { 'x-api-key': apiKey } }
      );

      const aiMessage = {
        role: 'assistant',
        content: response.data.data.message,
        timestamp: new Date(),
        provider: response.data.data.provider,
        model: response.data.data.model,
      };
      setMessages(prev => [...prev, aiMessage]);

    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to send message';
      setError(errorMessage);
      setMessages(prev => prev.slice(0, -1)); // remove optimistic user message
    } finally {
      setIsLoading(false);
    }
  };

  const currentProvider = PROVIDERS[provider];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-[#111111] rounded-xl shadow-lg border border-gray-200 dark:border-slate-800">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Multi-Provider AI Chat</h2>

      {/* ── Provider tabs ── */}
      <div className="flex gap-2 mb-5">
        {Object.entries(PROVIDERS).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setProvider(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              provider === key
                ? `${cfg.color} text-white shadow`
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {cfg.name}
          </button>
        ))}
      </div>

      {/* ── Model + Get Key row ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {currentProvider.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <a
            href={currentProvider.getKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            🔑 Get {currentProvider.name} Key
          </a>
        </div>
      </div>

      {/* ── API Key input ── */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
          {currentProvider.name} API Key
        </label>
        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            placeholder={currentProvider.keyPlaceholder}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            title={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? '🙈' : '👁️'}
          </button>
          {apiKey && (
            <button
              type="button"
              onClick={() => setApiKey('')}
              className="px-3 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
          Stored locally per provider — never sent to our servers.
        </p>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* ── Messages ── */}
      <div className="mb-4 h-96 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50 dark:bg-slate-900/50 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500 text-sm">
            No messages yet — start a conversation with {currentProvider.name}!
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-sm'
                  : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-white border border-gray-200 dark:border-slate-700 rounded-bl-sm'
              }`}>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <p className="text-[10px] opacity-60 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                  {msg.provider && ` · ${msg.provider}`}
                  {msg.model && ` · ${msg.model}`}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input row ── */}
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          placeholder={`Message ${currentProvider.name}...`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !apiKey.trim() || !message.trim()}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '...' : 'Send'}
        </button>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => { setMessages([]); setError(''); }}
            className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-xl text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  );
};

export default ChatInterface;
