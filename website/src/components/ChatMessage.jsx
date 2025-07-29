import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import 'highlight.js/styles/github-dark.css'; // ダークテーマ用のスタイル
import { ClipboardDocumentIcon, PlusCircleIcon } from '@heroicons/react/20/solid';

// highlight.jsに言語を登録
hljs.registerLanguage('javascript', javascript);

// メッセージのテキストを解析し、テキストとコードのパーツに分割する
function parseMessageContent(content) {
  const parts = [];
  if (!content) return parts;

  try {
    let lastIndex = 0;
    const regex = /```(\w*)\r?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
      }
      parts.push({
        type: 'code',
        language: match[1] || 'javascript', // デフォルトをjavascriptに
        value: match[2].trim(),
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.substring(lastIndex) });
    }

    if (parts.length === 0) {
      parts.push({ type: 'text', value: content });
    }

    return parts;
  } catch (error) {
    console.error("Failed to parse message content:", error);
    return [{ type: 'text', value: content }];
  }
}

// コードブロックコンポーネント
function CodeBlock({ language, code, onInsertCode }) {
  const codeRef = useRef(null);
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      setCopySuccess('Failed!');
    }
  };

  return (
    <div className="my-2 bg-gray-800 rounded-md overflow-hidden">
      <div className="flex justify-between items-center px-3 py-1 bg-gray-900 text-xs text-gray-400">
        <span>{language}</span>
        <div className="flex gap-2">
          <button
            onClick={() => onInsertCode(code)}
            className="flex items-center gap-1 hover:text-white"
            title="Insert into editor"
          >
            <PlusCircleIcon className="w-4 h-4" />
            Insert
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-white"
            title="Copy to clipboard"
          >
            <ClipboardDocumentIcon className="w-4 h-4" />
            {copySuccess || 'Copy'}
          </button>
        </div>
      </div>
      <pre className="p-3 text-sm overflow-x-auto"><code ref={codeRef} className={`language-${language}`}>{code}</code></pre>
    </div>
  );
}

export function ChatMessage({ message, onInsertCode }) {
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
              <CodeBlock
                key={index}
                language={part.language}
                code={part.value}
                onInsertCode={onInsertCode}
              />
            );
          }
          // Markdownをレンダリング
          return (
            <div key={index} className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>
                {part.value}
              </ReactMarkdown>
            </div>
          );
        })}
      </div>
    </div>
  );
}