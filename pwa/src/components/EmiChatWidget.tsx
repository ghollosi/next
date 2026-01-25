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
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.vemiax.com';
      const endpoint = isAuthenticated
        ? `${apiBase}/ai-chat/authenticated`
        : `${apiBase}/ai-chat/public`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isAuthenticated) {
        headers['X-User-Role'] = userRole;

        // Use the correct auth header based on role
        if (userRole === 'network_admin' || userRole === 'platform_admin') {
          headers['Authorization'] = `Bearer ${token}`;
        } else if (userRole === 'driver') {
          headers['x-driver-session'] = token!;
        } else if (userRole === 'operator') {
          headers['x-operator-session'] = token!;
        } else if (userRole === 'partner_admin') {
          headers['x-partner-session'] = token!;
        }
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
          <svg viewBox="0 0 100 100" className="w-10 h-10 sm:w-11 sm:h-11 rounded-full">
            <circle cx="50" cy="50" r="50" fill="#FDE8D0"/>
            <ellipse cx="50" cy="42" rx="20" ry="22" fill="#FCCBA0"/>
            <path d="M25 28 C25 10, 75 10, 75 28 C78 22, 80 30, 78 40 C82 30, 80 14, 68 8 C58 3, 42 3, 32 8 C20 14, 18 30, 22 40 C20 30, 22 22, 25 28Z" fill="#E8C860"/>
            <path d="M22 38 C18 50, 20 62, 28 58 C24 52, 22 44, 24 38Z" fill="#E8C860"/>
            <path d="M78 38 C82 50, 80 62, 72 58 C76 52, 78 44, 76 38Z" fill="#E8C860"/>
            <ellipse cx="40" cy="40" rx="4" ry="3.5" fill="white"/>
            <ellipse cx="60" cy="40" rx="4" ry="3.5" fill="white"/>
            <circle cx="40" cy="40.5" r="2.5" fill="#3B7DD8"/>
            <circle cx="60" cy="40.5" r="2.5" fill="#3B7DD8"/>
            <circle cx="40" cy="40" r="1" fill="#1a1a2e"/>
            <circle cx="60" cy="40" r="1" fill="#1a1a2e"/>
            <circle cx="41.2" cy="39" r="0.8" fill="white"/>
            <circle cx="61.2" cy="39" r="0.8" fill="white"/>
            <path d="M44 53 Q50 57, 56 53" stroke="#E05070" strokeWidth="2.2" fill="#E86070" strokeLinecap="round"/>
            <path d="M32 72 C32 68, 42 66, 50 72 C58 66, 68 68, 68 72 C70 85, 65 98, 50 98 C35 98, 30 85, 32 72Z" fill="white" opacity="0.9"/>
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
            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white/20">
              <svg viewBox="0 0 100 100" className="w-10 h-10">
                <circle cx="50" cy="50" r="50" fill="#FDE8D0"/>
                <ellipse cx="50" cy="42" rx="20" ry="22" fill="#FCCBA0"/>
                {/* Flowing blonde hair */}
                <path d="M25 28 C25 10, 75 10, 75 28 C78 22, 80 30, 78 40 C82 30, 80 14, 68 8 C58 3, 42 3, 32 8 C20 14, 18 30, 22 40 C20 30, 22 22, 25 28Z" fill="#E8C860"/>
                <path d="M22 38 C18 50, 20 65, 28 60 C24 55, 22 45, 24 38Z" fill="#E8C860"/>
                <path d="M78 38 C82 50, 80 65, 72 60 C76 55, 78 45, 76 38Z" fill="#E8C860"/>
                <path d="M28 30 C26 40, 24 52, 26 58" stroke="#D4B050" strokeWidth="1.5" fill="none" opacity="0.5"/>
                <path d="M72 30 C74 40, 76 52, 74 58" stroke="#D4B050" strokeWidth="1.5" fill="none" opacity="0.5"/>
                {/* Eyes with lashes */}
                <ellipse cx="40" cy="40" rx="4" ry="3.5" fill="white"/>
                <ellipse cx="60" cy="40" rx="4" ry="3.5" fill="white"/>
                <circle cx="40" cy="40.5" r="2.5" fill="#3B7DD8"/>
                <circle cx="60" cy="40.5" r="2.5" fill="#3B7DD8"/>
                <circle cx="40" cy="40" r="1" fill="#1a1a2e"/>
                <circle cx="60" cy="40" r="1" fill="#1a1a2e"/>
                <circle cx="41.2" cy="39" r="0.8" fill="white"/>
                <circle cx="61.2" cy="39" r="0.8" fill="white"/>
                <path d="M35 37 Q40 35, 44 37" stroke="#4A3520" strokeWidth="1.2" fill="none"/>
                <path d="M56 37 Q60 35, 65 37" stroke="#4A3520" strokeWidth="1.2" fill="none"/>
                {/* Lips */}
                <path d="M44 53 Q50 57, 56 53" stroke="#E05070" strokeWidth="2.2" fill="#E86070" strokeLinecap="round"/>
                <path d="M46 53 Q50 51, 54 53" stroke="#F08090" strokeWidth="1" fill="none"/>
                {/* Blush */}
                <ellipse cx="33" cy="48" rx="5" ry="3" fill="#FFB0A0" opacity="0.35"/>
                <ellipse cx="67" cy="48" rx="5" ry="3" fill="#FFB0A0" opacity="0.35"/>
                {/* Neck and top */}
                <path d="M44 62 L44 68 Q44 70, 42 72 L58 72 Q56 70, 56 68 L56 62" fill="#FCCBA0"/>
                <path d="M32 72 C32 68, 42 66, 50 72 C58 66, 68 68, 68 72 C70 85, 65 98, 50 98 C35 98, 30 85, 32 72Z" fill="#7C3AED"/>
                <path d="M42 72 Q50 78, 58 72" stroke="#FCCBA0" strokeWidth="1" fill="#FCCBA0" opacity="0.8"/>
              </svg>
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
