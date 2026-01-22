'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface EmiChatWidgetProps {
  // Optional: User context for authenticated users
  userRole?: 'driver' | 'operator' | 'partner_admin' | 'network_admin' | 'platform_admin';
  userId?: string;
  networkId?: string;
  partnerId?: string;
  locationId?: string;
  token?: string;
  // UI customization
  language?: 'hu' | 'en';
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
}

export default function EmiChatWidget({
  userRole,
  userId,
  networkId,
  partnerId,
  locationId,
  token,
  language = 'hu',
  position = 'bottom-right',
  primaryColor = '#6366f1', // Indigo
}: EmiChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isHu = language === 'hu';

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Add initial greeting message when chat first opens
  useEffect(() => {
    if (isOpen && !hasGreeted) {
      const greeting: Message = {
        id: 'greeting',
        role: 'assistant',
        content: isHu
          ? 'Szia! Émi vagyok, a vSys Wash asszisztense. Miben segíthetek ma? 🚗✨'
          : "Hi! I'm Amy, the vSys Wash assistant. How can I help you today? 🚗✨",
        timestamp: new Date(),
      };
      setMessages([greeting]);
      setHasGreeted(true);
    }
  }, [isOpen, hasGreeted, isHu]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build conversation history (last 10 messages)
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Determine endpoint and headers
      const isAuthenticated = userRole && token;
      const endpoint = isAuthenticated
        ? 'https://api.vemiax.com/ai-chat/authenticated'
        : 'https://api.vemiax.com/ai-chat/public';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isAuthenticated) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-User-Role'] = userRole;
        if (userId) headers['X-User-ID'] = userId;
        if (networkId) headers['X-Network-ID'] = networkId;
        if (partnerId) headers['X-Partner-ID'] = partnerId;
        if (locationId) headers['X-Location-ID'] = locationId;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error('API error');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: isHu
          ? 'Hoppá, valami hiba történt! Kérlek próbáld újra.'
          : 'Oops, something went wrong! Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, userRole, token, userId, networkId, partnerId, locationId, language, isHu]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const positionClasses = position === 'bottom-right'
    ? 'right-4 sm:right-6'
    : 'left-4 sm:left-6';

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 sm:bottom-6 ${positionClasses} z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-lg
                   flex items-center justify-center transition-all duration-300 hover:scale-110`}
        style={{ backgroundColor: primaryColor }}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-20 sm:bottom-24 ${positionClasses} z-50 w-[calc(100%-2rem)] sm:w-96
                     bg-white rounded-2xl shadow-2xl overflow-hidden
                     animate-in slide-in-from-bottom-4 duration-300`}
          style={{ maxHeight: 'calc(100vh - 150px)' }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 text-white flex items-center gap-3"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{isHu ? 'Émi' : 'Amy'}</h3>
              <p className="text-xs opacity-80">{isHu ? 'vSys Wash Asszisztens' : 'vSys Wash Assistant'}</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: primaryColor } : {}}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-800 px-4 py-2 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t bg-white">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isHu ? 'Írd ide a kérdésed...' : 'Type your question...'}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm
                         focus:outline-none focus:ring-2 focus:ring-opacity-50
                         disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                maxLength={500}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="w-10 h-10 rounded-full flex items-center justify-center
                         text-white disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all hover:scale-105"
                style={{ backgroundColor: primaryColor }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {isHu ? 'Émi AI-alapú asszisztens' : 'Amy is an AI-powered assistant'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
