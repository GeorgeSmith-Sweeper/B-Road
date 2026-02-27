'use client';

import { useState, useRef, useEffect } from 'react';
import { sendChatMessage, ChatSearchResult, ChatMessagePayload } from '@/lib/chat-api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  results?: ChatSearchResult['results'];
}

interface ChatInterfaceProps {
  onResultsReceived?: (results: ChatSearchResult['results']) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function ChatInterface({ onResultsReceived, isOpen, onToggle }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! Ask me to find twisty roads. Try "Find epic curvy roads in Vermont" or "Show me super twisty mountain roads in California".',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatResults = (data: ChatSearchResult): string => {
    const { results, filters } = data;
    const count = results.metadata?.count || 0;

    if (count === 0) {
      return 'No roads found matching your criteria. Try broadening your search or checking a different state.';
    }

    // Build response text
    let response = `Found ${count} road${count !== 1 ? 's' : ''}`;

    // Add filter info
    const filterParts: string[] = [];
    if (filters.min_curvature) filterParts.push(`curvature >= ${filters.min_curvature}`);
    if (filters.sources && Array.isArray(filters.sources)) {
      filterParts.push(`in ${(filters.sources as string[]).join(', ')}`);
    }
    if (filterParts.length > 0) {
      response += ` (${filterParts.join(', ')})`;
    }
    response += ':\n\n';

    // List top roads
    const topRoads = results.features.slice(0, 5);
    topRoads.forEach((road, i) => {
      const props = road.properties;
      const name = props.name || 'Unnamed Road';
      response += `${i + 1}. ${name}\n`;
      response += `   Curvature: ${props.curvature.toLocaleString()} | ${props.length_mi.toFixed(1)} mi\n`;
    });

    if (count > 5) {
      response += `\n...and ${count - 5} more roads highlighted on the map.`;
    }

    return response;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const query = input;
    setInput('');
    setIsLoading(true);

    try {
      // Build history from existing messages (skip the initial welcome message)
      const history: ChatMessagePayload[] = messages
        .slice(1)
        .map((msg) => ({ role: msg.role, content: msg.content }));

      const data = await sendChatMessage(query, 10, history);

      // Use Claude's conversational response, falling back to formatted results
      const responseText = data.response || formatResults(data);

      const botMessage: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        results: data.results,
      };
      setMessages((prev) => [...prev, botMessage]);

      // Notify parent of results for map highlighting
      if (onResultsReceived && data.results.features.length > 0) {
        onResultsReceived(data.results);
      }
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, there was an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Floating button — desktop only (mobile uses nav bar icon) */}
      <button
        onClick={onToggle}
        className={`
          hidden md:flex
          bg-blue-600 text-white rounded-full p-4 shadow-lg
          hover:bg-blue-700 transition-all duration-200
          ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
        `}
        aria-label="Open chat"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </button>

      {/* Chat panel — full-screen overlay on mobile, corner panel on desktop */}
      <div
        className={`
          fixed inset-0 md:absolute md:inset-auto md:bottom-0 md:right-0
          w-full md:w-96 h-full md:h-[500px]
          bg-white md:rounded-lg shadow-2xl
          flex flex-col overflow-hidden
          transition-all duration-200 md:origin-bottom-right
          ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b bg-blue-600 text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold">Road Discovery</h3>
            <p className="text-xs text-blue-100">Powered by Claude AI</p>
          </div>
          <button
            onClick={onToggle}
            className="text-white hover:text-blue-200 transition-colors"
            aria-label="Close chat"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[85%] rounded-lg p-3
                  ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white text-gray-900 shadow-sm border rounded-bl-none'
                  }
                `}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-900 shadow-sm border rounded-lg rounded-bl-none p-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe your perfect drive..."
              className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
