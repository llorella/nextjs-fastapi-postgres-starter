'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchMessages, Message, User } from '../../api';
import ChatWindow from '../../components/ChatWindow';

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = () => {
      try {
        const storedUser = sessionStorage.getItem('chatUser');
        if (!storedUser) {
          router.push('/login');
          return;
        }

        const userData = JSON.parse(storedUser) as User;
        setUser(userData);

        setIsLoading(true);
        fetchMessages(userData.id)
          .then(setMessages)
          .catch(error => {
            console.error('Error fetching messages:', error);
            // if we can't fetch messages, still set loading to false
          })
          .finally(() => setIsLoading(false));
      } catch (error) {
        console.error('Error in chat page initialization:', error);
        router.push('/login');
      }
    };

    checkUser();
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem('chatUser');
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; 
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-2xl flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Real-Time Chatbot</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md"
        >
          Logout
        </button>
      </div>
      <ChatWindow 
        initialMessages={messages} 
        userName={user.name} 
        userId={user.id} 
      />
    </main>
  );
}
