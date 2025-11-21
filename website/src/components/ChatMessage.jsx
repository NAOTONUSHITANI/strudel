import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import 'highlight.js/styles/github-dark.css'; // ダークテーマ用のスタイル
import { ClipboardDocumentIcon, PlusCircleIcon } from '@heroicons/react/20/solid';

// highlight.jsに言語を登録
hljs.registerLanguage('javascript', javascript);

/**
 * A definitive, robust parser that correctly handles all known code block variations,
 * including those with or without language specifiers, and single-line blocks.
 */
function parseMessageContent(content) {
  const parts = [];
  if (!content) return parts;

  // Split by the code fence. The logic is that every second element is code.
  const splits = content.split('```');

  for (let i = 0; i < splits.length; i++) {
    const part = splits[i];

    // Even-indexed parts (0, 2, 4, ...) are plain text.
    if (i % 2 === 0) {
      if (part) {
        parts.push({ type: 'text', value: part });
      }
    }
    // Odd-indexed parts (1, 3, 5, ...) are code blocks.
    else {
      // An empty part here means an empty code block like ``````
      if (part === '') {
        parts.push({ type: 'code', language: 'javascript', value: '' });
        continue;
      }

      const firstLineEnd = part.indexOf('\n');
      let language = '';
      let code = '';

      // Heuristic to check if the first line is a language specifier.
      // A language specifier is assumed to be a short, single word.
      const potentialLang = (firstLineEnd === -1) ? part.trim() : part.substring(0, firstLineEnd).trim();
      const potentialCode = (firstLineEnd === -1) ? '' : part.substring(firstLineEnd + 1);

      // If the first line is a short word with no spaces, it's likely a language.
      if (potentialLang.match(/^[a-zA-Z0-9\-_]*$/) && potentialLang.length < 15 && potentialCode) {
        language = potentialLang;
        code = potentialCode;
      } else {
        // Otherwise, the whole block is code with a default language.
        language = 'javascript';
        code = part;
      }

      parts.push({
        type: 'code',
        language: language || 'javascript', // Fallback for safety
        value: code.trim(),
      });
    }
  }
  return parts;
}


// コードブロックコンポーネント
function CodeBlock({ language, code, onInsertCode, hideInlineInsert }) {
  const codeRef = useRef(null);
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    if (codeRef.current) {
      // Clear previous highlighting
      codeRef.current.removeAttribute('data-highlighted');
      // Highlight
      hljs.highlightElement(codeRef.current);
    }
  }, [code, language]);

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
          {!hideInlineInsert && (
            <button
              onClick={() => onInsertCode(code)}
              className="flex items-center gap-1 hover:text-white"
              title="Insert into editor"
            >
              <PlusCircleIcon className="w-4 h-4" />
              Insert
            </button>
          )}
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

export function ChatMessage({ message, onInsertCode, hideInlineInsert }) {
  const parts = parseMessageContent(message.content);

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`overflow-x-hidden max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl break-words whitespace-pre-wrap rounded-lg px-4 py-2 ${
          message.role === 'user' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-200'
        }`}
      >
        {parts.map((part, index) => {
          if (part.type === 'code') {
            return (
              <CodeBlock
                key={index}
                language={part.language}
                code={part.value}
                onInsertCode={onInsertCode}
                hideInlineInsert={hideInlineInsert}
              />
            );
          }
          // Markdownをレンダリング
          if (part.value) { // Don't render empty text parts
            return (
              <div key={index} className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>
                  {part.value}
                </ReactMarkdown>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
