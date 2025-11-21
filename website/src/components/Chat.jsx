import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage.jsx';
import { ArrowPathIcon } from '@heroicons/react/20/solid';

const CHAT_HISTORY_KEY = 'strudel-chat-history';
const INITIAL_MESSAGE = { role: 'assistant', content: 'こんにちは！Strudelで何を作りますか？' };
const MIN_WIDTH = 300; // Minimum width in pixels
const MIN_HEIGHT = 200; // Minimum height in pixels

export function Chat({ onInsertCode, onClose, onReplaceSelection, hasSelection }) {
  const [messages, setMessages] = useState(() => {
    try {
      const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        return parsedHistory.length > 0 ? parsedHistory : [INITIAL_MESSAGE];
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
    return [INITIAL_MESSAGE];
  });

  const [input, setInput] = useState('');
  const [isLoading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [isComposing, setIsComposing] = useState(false);
  const [size, setSize] = useState({ width: 480, height: 600 }); // Default: 30rem = 480px
  const abortControllerRef = useRef(null);
  const [openChooserIndex, setOpenChooserIndex] = useState(null);
  const [chooserMode, setChooserMode] = useState('insert'); // 'insert' or 'replace'

  // Resize handler logic
  useEffect(() => {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;

    const onMouseDown = (e, direction) => {
      e.preventDefault();
      const startSize = size;
      const startPos = { x: e.clientX, y: e.clientY };

      const onMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startPos.x;
        const deltaY = moveEvent.clientY - startPos.y;
        let newWidth = startSize.width;
        let newHeight = startSize.height;

        if (direction.includes('left')) {
          newWidth = startSize.width - deltaX;
        }
        if (direction.includes('top')) {
          newHeight = startSize.height - deltaY;
        }

        setSize({
          width: Math.max(MIN_WIDTH, newWidth),
          height: Math.max(MIN_HEIGHT, newHeight),
        });
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    const handles = [
      { element: chatWindow.querySelector('.resize-handle-l'), direction: 'left' },
      { element: chatWindow.querySelector('.resize-handle-t'), direction: 'top' },
      { element: chatWindow.querySelector('.resize-handle-tl'), direction: 'top-left' },
    ];

    const mouseDownListeners = [];

    handles.forEach(({ element, direction }) => {
      if (element) {
        const listener = (e) => onMouseDown(e, direction);
        element.addEventListener('mousedown', listener);
        mouseDownListeners.push({ element, listener });
      }
    });

    return () => {
      mouseDownListeners.forEach(({ element, listener }) => {
        element.removeEventListener('mousedown', listener);
      });
    };
  }, [size]);


  // テキストをURLセーフなBase64文字列にエンコード
  function b64Encode(str) {
    const base64 = btoa(unescape(encodeURIComponent(str)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  // 全ての fenced code blocks を抽出して配列で返す
  function extractCodeBlocks(text) {
    if (typeof text !== 'string') return [];
    const re = /```(?:\s*([^\n]*))?\n?([\s\S]*?)```/g;
    const blocks = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      const lang = (m[1] || '').trim();
      let code = m[2] ?? '';
      if (code.startsWith('\n')) code = code.slice(1);
      if (code.endsWith('\n')) code = code.slice(0, -1);
      blocks.push({ language: lang || 'text', code, raw: m[0] });
    }
    return blocks;
  }

  // 新しいメッセージで自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 会話履歴をlocalStorageに保存
  useEffect(() => {
    try {
      if (messages.length > 1 || (messages.length === 1 && messages[0].content !== INITIAL_MESSAGE.content)) {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
      }
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }, [messages]);

  const handleReset = () => {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    setMessages([INITIAL_MESSAGE]);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
  
    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
  
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
  
    const messagesForApi = newMessages.filter(msg => msg.content !== INITIAL_MESSAGE.content);
    const requestPayload = JSON.stringify({ messages: messagesForApi });
    const encodedData = b64Encode(requestPayload);
  
    const url = `/api/chat/${encodedData}`;
    
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      const response = await fetch(url, { signal });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`APIエラー: ${response.status} ${errorText}`);
      }
  
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        const chunk = decoder.decode(value, { stream: true });
        
        setMessages((prev) => {
          const updatedMessages = [...prev];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          if (lastMessage.role === 'assistant') {
            lastMessage.content += chunk;
          }
          return updatedMessages;
        });
      }
  
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted by user.');
        setMessages((prev) => {
          const updatedMessages = [...prev];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          if (lastMessage.role === 'assistant' && lastMessage.content === '') {
            lastMessage.content = 'AIからの応答を停止しました。';
          }
          return updatedMessages;
        });
      } else {
        console.error('Chat error:', error);
        setMessages((prev) => {
          const updatedMessages = [...prev];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          if (lastMessage.role === 'assistant' && lastMessage.content === '') {
            lastMessage.content = `エラーが発生しました: ${error.message}`;
          } else {
            updatedMessages.push({ role: 'assistant', content: `エラーが発生しました: ${error.message}` });
          }
          return updatedMessages;
        });
      }
    } finally {
      setLoading(false);
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <div
      id="chat-window"
      className="fixed bottom-5 right-5 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-40"
      style={{ width: `${size.width}px`, height: `${size.height}px` }}
    >
      {/* Resize Handles */}
      <div className="resize-handle-t absolute top-0 left-0 w-full h-2 cursor-ns-resize"></div>
      <div className="resize-handle-l absolute top-0 left-0 w-2 h-full cursor-ew-resize"></div>
      <div className="resize-handle-tl absolute top-0 left-0 w-3 h-3 cursor-nwse-resize"></div>

      <header className="p-4 border-b border-gray-700 bg-gray-800 text-gray-200 font-bold text-lg flex justify-between items-center flex-shrink-0">
        <span>AI Chat</span>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="text-gray-400 hover:text-white" title="Reset conversation">
            <ArrowPathIcon className="h-5 w-5" />
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white" title="Close chat">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showSeparator = prevMsg && prevMsg.role === 'user' && msg.role === 'assistant';

          // While loading, if this is the last message and it's an empty assistant placeholder,
          // don't render it. The loading indicator will be shown instead.
          if (isLoading && index === messages.length - 1 && msg.role === 'assistant' && msg.content === '') {
            return null; // Prevents the empty bubble from appearing
          }

          // Non-assistant messages: keep existing rendering
          if (msg.role !== 'assistant') {
            return (
              <React.Fragment key={index}>
                {showSeparator && <hr className="my-4 border-gray-700" />}
                <ChatMessage message={msg} onInsertCode={onInsertCode} />
              </React.Fragment>
            );
          }

          // Assistant messages: render message, then show "エディタに反映" button
          // If multiple code blocks exist, show a chooser to pick one.
          const blocks = extractCodeBlocks(msg.content || '');
          const preferred = blocks.filter(b => ['js', 'javascript', 'strudel'].includes((b.language || '').toLowerCase()));

          return (
            <React.Fragment key={index}>
              {showSeparator && <hr className="my-4 border-gray-700" />}
              <ChatMessage message={msg} onInsertCode={onInsertCode} hideInlineInsert={true} />

              {blocks.length > 0 && (
                <div className="px-4 mt-2 flex flex-col items-end">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        try {
                          if (preferred.length === 1) {
                            onInsertCode?.(preferred[0].code);
                            return;
                          }
                          if (preferred.length > 1) {
                            // multiple preferred: open chooser filtered to preferred
                            setChooserMode('insert');
                            setOpenChooserIndex(openChooserIndex === index ? null : index);
                            return;
                          }

                          // No preferred (not JS/Strudel) -> warn and require explicit confirmation
                          const proceed = window.confirm(
                            'AIの返答はStrudel/JavaScriptではない可能性があります。挿入するとエラーが発生するかもしれません。挿入しますか？'
                          );
                          if (proceed && blocks.length > 0) {
                            onInsertCode?.(blocks[0].code);
                          }
                        } catch (err) {
                          console.error('onInsertCode handler threw:', err);
                        }
                      }}
                      className={`px-3 py-1 rounded-lg ${preferred.length > 0 ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-yellow-600 hover:bg-yellow-500 text-white'}`}
                      title={preferred.length > 0 ? 'AIの提案をエディタに挿入します' : 'AIの返答がJSではありません。挿入前に確認が必要です'}
                    >
                      エディタに反映
                    </button>
                    {hasSelection && blocks.length > 0 && (
                      <button
                        onClick={() => {
                          try {
                            if (preferred.length === 1) {
                              onReplaceSelection?.(preferred[0].code);
                              return;
                            }
                            if (preferred.length > 1) {
                              // multiple preferred: open chooser in replace mode
                              setChooserMode('replace');
                              setOpenChooserIndex(openChooserIndex === index ? null : index);
                              return;
                            }

                            // No preferred (not JS/Strudel) -> warn and require explicit confirmation
                            const proceed = window.confirm(
                              'AIの返答はStrudel/JavaScriptではない可能性があります。選択範囲を置き換えるとエラーが発生するかもしれません。置き換えますか？'
                            );
                            if (proceed && blocks.length > 0) {
                              onReplaceSelection?.(blocks[0].code);
                            }
                          } catch (err) {
                            console.error('onReplaceSelection handler threw:', err);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white`}
                        title={'選択範囲をAIの提案で置き換えます'}
                      >
                        選択範囲を置き換え
                      </button>
                    )}
                  </div>

                  {openChooserIndex === index && blocks.length > 1 && (
                    <div className="mt-2 w-64 bg-gray-800 border border-gray-700 rounded-md shadow-lg p-2" role="menu">
                      {blocks.map((b, bi) => (
                        <button
                          key={bi}
                          onClick={() => {
                            try {
                              if (chooserMode === 'replace') {
                                onReplaceSelection?.(b.code);
                              } else {
                                onInsertCode?.(b.code);
                              }
                            } catch (err) {
                              console.error('chooser handler threw:', err);
                            }
                            setOpenChooserIndex(null);
                          }}
                          className="w-full text-left px-2 py-1 rounded hover:bg-gray-700"
                        >
                          <div className="text-xs text-gray-300">{b.language}</div>
                          <div className="truncate text-sm text-gray-100">{b.code.split('\n')[0]}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
        {/* The loading indicator is now shown without a duplicate empty bubble. */}
        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '' && (
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
      <footer className="p-4 border-t border-gray-700 bg-gray-800 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isComposing && !isLoading) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="メッセージを入力..."
            className="flex-1 p-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              onClick={handleStop}
              className="p-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 flex items-center justify-center w-10 h-10"
              title="Stop generation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              className="p-2 bg-white text-black font-semibold rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-gray-200 flex items-center justify-center w-10 h-10"
              disabled={!input.trim()}
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
          )}
        </div>
      </footer>
    </div>
  );
}

// ヘルパー: テキストから最初の fenced code block の中身だけを取り出す
function extractFirstCodeBlock(text) {
  if (typeof text !== 'string') return null;
  const re = /```(?:\s*[^\n]*)?\n?([\s\S]*?)```/;
  const match = re.exec(text);
  if (!match) return null;

  let content = match[1] ?? '';
  if (content.startsWith('\n')) content = content.slice(1);
  if (content.endsWith('\n')) content = content.slice(0, -1);
  return content;
}
