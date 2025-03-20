import { fetchCurrentUser, fetchMessages, Message, User } from '../lib/api';
import ChatWindow from '../components/ChatWindow';

export default async function Home() {
  let user: User = { id: 0, name: 'Guest' };
  let messages: Message[] = [];
  
  try {
    // fetch user and messages in parallel
    const [userResponse, messagesResponse] = await Promise.all([
      fetchCurrentUser(),
      fetchMessages()
    ]);
    
    user = userResponse;
    messages = messagesResponse;
  } catch (error) {
    console.error('Error fetching data:', error);
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">Real-Time Chatbot</h1>
      <ChatWindow initialMessages={messages} userName={user.name} />
    </main>
  );
}
