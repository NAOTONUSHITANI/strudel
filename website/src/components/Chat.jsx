import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage.jsx';

// This is a simplified version that only takes props
export function Chat({ onInsertCode, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [isComposing, setIsComposing] = useState(false);

  // テキストをURLセーフなBase64文字列にエンコード
  function b64Encode(str) {
    const base64 = btoa(unescape(encodeURIComponent(str)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  // 最初のメッセージを表示
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ role: 'assistant', content: 'こんにちは！Strudelで何を作りますか？' }]);
    }
  }, []);

  // 新しいメッセーシ
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const messagesForApi = newMessages;
    const requestPayload = JSON.stringify({ messages: messagesForApi });
    const encodedData = b64Encode(requestPayload);

    const url = `/api/chat/${encodedData}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: '不明なエラーが発生しました',
          details: { message: response.statusText }
        }));
        const message = errorData?.error || `APIエラー: ${response.status}`;
        const details = errorData?.details ? `\n詳細: ${JSON.stringify(errorData.details, null, 2)}` : '';
        throw new Error(`${message}${details}`);
      }

      const data = await response.json();
      
      if (!data || !data.response) {
        throw new Error('サーバーからの応答が不正です');
      }

      const aiMessage = { role: 'assistant', content: data.response };
      setMessages((prev) => [...prev, aiMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = { role: 'assistant', content: `エラーが発生しました: ${error.message}` };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 w-96 h-[500px] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-40">
      <header className="p-4 border-b border-gray-700 bg-gray-800 text-gray-200 font-bold text-lg flex justify-between items-center">
        <span>AI Chat</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>
      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <ChatMessage key={index} message={msg} onInsertCode={onInsertCode} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>
      <footer className="p-4 border-t border-gray-700 bg-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="メッセージを入力..."
            className="flex-1 p-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            className="p-2 bg-white text-black font-semibold rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-gray-200 flex items-center justify-center w-10 h-10"
            disabled={isLoading || !input.trim()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}