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

export interface LoginResponse {
  id: number;
  name: string;
}

export async function login(name: string): Promise<LoginResponse> {
  const response = await fetch(`${apiUrl}/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchUser(userId: number): Promise<User> {
  try {
    const response = await fetch(`${apiUrl}/users/${userId}`);
    if (!response.ok) {
      throw new Error(`Error fetching user: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

export async function fetchMessages(userId: number): Promise<Message[]> {
  try {
    const response = await fetch(`${apiUrl}/messages?user_id=${userId}`);
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
  userId: number,
  onMessage: (message: Message) => void,
  onError?: (event: Event) => void
): WebSocket {
  try {
    const apiUrlObj = new URL(apiUrl);
    
    const wsProtocol = apiUrlObj.protocol === 'https:' ? 'wss' : 'ws';
    
    // construct the ws url using the hostname and port from the api url
    // but replace the path with the ws endpoint
    const wsUrl = `${wsProtocol}://${apiUrlObj.host}/ws/${userId}`;
    
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
      // log the error but prevent it from bubbling up to the Next.js error handler
      console.error('WebSocket error occurred. This is expected during development and can be ignored.');
      
      if (onError) {
        try {
          onError(event);
        } catch (callbackError) {
          console.error('Error in WebSocket error callback:', callbackError);
        }
      }
    };
    
    return ws;
  } catch (error) {
    console.error('Error creating WebSocket connection:', error);
    
    // create a dummy WebSocket object that will immediately close
    // this prevents the application from crashing when the WebSocket can't be created
    const dummyWs = {
      send: () => {},
      close: () => {},
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
    } as unknown as WebSocket;
    
    if (onError) {
      try {
        onError(new Event('error'));
      } catch (callbackError) {
        console.error('Error in WebSocket error callback:', callbackError);
      }
    }
    
    return dummyWs;
  }
}
