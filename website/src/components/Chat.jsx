import { useState, useEffect, useRef } from 'react';

export function Chat({ onInsertCode }) {
  const [isOpen, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // チャットが開かれたときに最初のメッセージを表示
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ type: 'ai', text: 'こんにちは！Strudelで何を作りますか？' }]);
    }
  }, [isOpen]);

  // 新しいメッセージが追加されたら一番下までスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { type: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error(`APIエラー: ${response.statusText}`);
      }

      const data = await response.json();
      const aiMessage = { type: 'ai', text: data.reply };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = { type: 'ai', text: `エラーが発生しました: ${error.message}` };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // TODO: AIの返信からコード部分を抽出し、挿入ボタンを表示する機能を後で追加
  // const extractCode = (text) => { ... };

  return (
    <>
      {/* チャットボックス本体 */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 w-96 h-[500px] bg-white rounded-lg shadow-2xl flex flex-col z-40">
          <header className="p-4 border-b font-bold text-lg">AIアシスタント</header>
          <main className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl break-words whitespace-pre-wrap rounded-lg px-4 py-2 ${
                    msg.type === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 rounded-lg px-4 py-2">考え中...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </main>
          <footer className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="メッセージを入力..."
                className="flex-1 p-2 border rounded-lg"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-blue-300"
                disabled={isLoading}
              >
                送信
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* フローティングボタン */}
      <button
        onClick={() => setOpen(!isOpen)}
        className="fixed bottom-5 right-5 bg-blue-500 text-white rounded-full w-14 h-14 flex items-center justify-center text-2xl shadow-lg z-50 hover:bg-blue-600"
        title="AIチャット"
      >
        💬
      </button>
    </>
  );
}
