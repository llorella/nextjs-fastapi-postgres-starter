'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Message, createWebSocketConnection } from '../api';

interface ChatWindowProps {
  initialMessages: Message[];
  userName: string;
  userId: number; 
}

export default function ChatWindow({ initialMessages, userName, userId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true); // Track initial connection attempt
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000; 
    
    const connectWebSocket = () => {
      // only create WebSocket connection if userId is valid
      if (!userId) return;
      
      try {
        // clear any existing connection
        if (wsRef.current) {
          wsRef.current.onopen = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onmessage = null;
          wsRef.current.close();
          wsRef.current = null;
        }
        
        ws = createWebSocketConnection(
          userId,
          (message) => {
            try {
              setMessages((prevMessages) => [...prevMessages, message]);
            } catch (err) {
              console.error('Error updating messages state:', err);
            }
          },
          (error) => {
            // this error is already logged in the createWebSocketConnection function
            // just update the connection state
            setIsConnected(false);
          }
        );

        ws.onopen = () => {
          setIsConnected(true);
          setIsConnecting(false); // Connection attempt complete
          console.log('WebSocket connected');
          reconnectAttempts = 0; // reset reconnect attempts on successful connection
        };

        ws.onclose = (event) => {
          setIsConnected(false);
          setIsConnecting(false);
          console.log('WebSocket disconnected', event.code, event.reason);
          
          // only attempt to reconnect if this wasn't a clean close and we haven't exceeded max attempts
          if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
            }
            
            reconnectTimeout = setTimeout(() => {
              connectWebSocket();
            }, RECONNECT_DELAY);
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setIsConnected(false);
      }
    };
    
    connectWebSocket();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      if (wsRef.current) {
        // remove all event handlers to prevent memory leaks
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [userId]); 

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
        {!isConnected && !isConnecting && (
          <div className="text-red-500 text-xs mt-2">
            Disconnected from server. Please refresh the page.
          </div>
        )}
      </div>
    </div>
  );
}
