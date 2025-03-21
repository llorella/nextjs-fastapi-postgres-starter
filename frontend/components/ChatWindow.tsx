'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Message, createWebSocketConnection } from '../api';

interface ChatWindowProps {
  initialMessages: Message[];
  userName: string;
}

export default function ChatWindow({ initialMessages, userName }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const ws = createWebSocketConnection((message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = () => {
    if (input.trim() && wsRef.current && isConnected) {
      wsRef.current.send(input);
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'h:mm a');
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-2xl mx-auto border rounded-lg shadow-md bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-blue-500 text-white rounded-t-lg">
        <h2 className="text-xl font-semibold">Hello User</h2>
        <p className="text-sm">Logged in as {userName}</p>
        <div className="text-xs mt-1">
          Status: {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.is_from_user ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.is_from_user
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-800 rounded-bl-none'
                }`}
              >
                <div className="break-words">{msg.content}</div>
                <div
                  className={`text-xs mt-1 ${
                    msg.is_from_user ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {formatTimestamp(msg.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-gray-800"
            rows={2}
            disabled={!isConnected}
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || !input.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300"
          >
            Send
          </button>
        </div>
        {!isConnected && (
          <div className="text-red-500 text-xs mt-2">
            Disconnected from server. Please refresh the page.
          </div>
        )}
      </div>
    </div>
  );
}
