import { useState } from 'react';
import { ClipboardDocumentIcon, PlusCircleIcon } from '@heroicons/react/20/solid';

// メッセージのテキストを解析し、テキストとコードのパーツに分割する
function parseMessageContent(content) {
  const parts = [];
  if (!content) return parts;

  try {
    let lastIndex = 0;
    // 堅牢化した正規表現: 言語指定がなくてもOK、改行コードの違いにも対応
    const regex = /```(\w*)\r?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // コードブロックの前のテキスト部分
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
      }
      // コードブロック部分
      parts.push({
        type: 'code',
        language: match[1] || 'text',
        value: match[2].trim(),
      });
      lastIndex = match.index + match[0].length;
    }

    // 最後のコードブロックの後のテキスト部分
    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.substring(lastIndex) });
    }

    // もしコードブロックが見つからなければ、全体をテキストとして扱う
    if (parts.length === 0) {
      parts.push({ type: 'text', value: content });
    }

    return parts;
  } catch (error) {
    console.error("Failed to parse message content:", error);
    // エラーが発生した場合は、全体をプレーンテキストとして扱う
    return [{ type: 'text', value: content }];
  }
}


export function ChatMessage({ message, onInsertCode }) {
  const [copySuccess, setCopySuccess] = useState('');

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000); // 2秒後にメッセージを消す
    } catch (err) {
      setCopySuccess('Failed!');
    }
  };

  const parts = parseMessageContent(message.content);

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl break-words whitespace-pre-wrap rounded-lg px-4 py-2 ${
          message.role === 'user' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-200'
        }`}
      >
        {parts.map((part, index) => {
          if (part.type === 'code' && part.value) {
            return (
              <div key={index} className="my-2 bg-gray-800 rounded-md overflow-hidden">
                <div className="flex justify-between items-center px-3 py-1 bg-gray-900 text-xs text-gray-400">
                  <span>{part.language}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onInsertCode(part.value)}
                      className="flex items-center gap-1 hover:text-white"
                      title="Insert into editor"
                    >
                      <PlusCircleIcon className="w-4 h-4" />
                      Insert
                    </button>
                    <button
                      onClick={() => handleCopy(part.value)}
                      className="flex items-center gap-1 hover:text-white"
                      title="Copy to clipboard"
                    >
                      <ClipboardDocumentIcon className="w-4 h-4" />
                      {copySuccess || 'Copy'}
                    </button>
                  </div>
                </div>
                <pre className="p-3 text-sm overflow-x-auto"><code>{part.value}</code></pre>
              </div>
            );
          }
          return <p key={index} className="inline">{part.value}</p>;
        })}
      </div>
    </div>
  );
}