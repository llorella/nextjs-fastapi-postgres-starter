const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Message {
  id: number;
  user_id: number;
  content: string;
  is_from_user: boolean;
  timestamp: string;
}

export interface User {
  id: number;
  name: string;
}

export async function fetchCurrentUser(): Promise<User> {
  try {
    const response = await fetch(`${apiUrl}/users/me`);
    if (!response.ok) {
      throw new Error(`Error fetching user: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    return { id: 0, name: 'Guest' };
  }
}

export async function fetchMessages(): Promise<Message[]> {
  try {
    const response = await fetch(`${apiUrl}/messages`);
    if (!response.ok) {
      throw new Error(`Error fetching messages: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

export function createWebSocketConnection(
  onMessage: (message: Message) => void,
  onError?: (event: Event) => void
): WebSocket {
  const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${apiUrl.replace(/^https?:\/\//, '')}/ws`;
  
  const ws = new WebSocket(wsUrl);
  
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as Message;
      onMessage(message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onerror = (event) => {
    console.error('WebSocket error:', event);
    if (onError) {
      onError(event);
    }
  };
  
  return ws;
}