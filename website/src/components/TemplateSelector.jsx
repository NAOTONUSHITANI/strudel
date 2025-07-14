import { useState, useEffect } from 'react';

// Viteの特殊なインポート機能を使って、templatesディレクトリ内の全.strudelファイルを
// テキストとして一度にインポートします。
const templateModules = import.meta.glob('../templates/*.strudel', {
  as: 'raw',
  eager: true, // 即時に読み込む
});

// ファイルパスからテンプレートのタイトルを抽出するヘルパー関数
// 例: ../templates/Lo-fi HIPHOP.strudel -> Lo-fi HIPHOP
const getTitleFromPath = (path) => {
  return path.split('/').pop().replace('.strudel', '');
};

// テンプレートのリストを生成
const templates = Object.entries(templateModules).map(([path, code]) => ({
  title: getTitleFromPath(path),
  code,
}));

export function TemplateSelector({ onInsert, onClose }) {
  // 選択されているテンプレートを管理するstate
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);

  // キーボード操作（Escapeキーで閉じる）のためのイベントリスナー
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // エディタにコードを挿入する処理
  const handleInsert = () => {
    if (selectedTemplate) {
      onInsert(selectedTemplate.code);
      onClose(); // 挿入後にモーダルを閉じる
    }
  };

  // クリップボードにコードをコピーする処理
  const handleCopy = (e) => {
    if (selectedTemplate) {
      navigator.clipboard.writeText(selectedTemplate.code);
      // ボタンのテキストを一時的に変更してフィードバック
      const button = e.target;
      const originalText = button.textContent;
      button.textContent = 'コピーしました！';
      setTimeout(() => {
        button.textContent = originalText;
      }, 1500);
    }
  };

  // モーダルの背景をクリックしたときに閉じる処理
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '80vh' }}>
        <header className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">コードテンプレート</h2>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-800">&times;</button>
        </header>

        <main className="flex-grow flex p-4 gap-4 overflow-hidden">
          {/* 左側のテンプレートリスト */}
          <aside className="w-1/4 flex-shrink-0 border-r pr-4 overflow-y-auto">
            <nav className="flex flex-col gap-2">
              {templates.map((template) => (
                <button
                  key={template.title}
                  className={`w-full text-left p-2 rounded ${
                    selectedTemplate.title === template.title
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  {template.title}
                </button>
              ))}
            </nav>
          </aside>

          {/* 右側のコードプレビュー */}
          <section className="w-3/4 flex flex-col">
            <div className="flex-grow bg-gray-800 text-white rounded-md p-4 overflow-y-auto">
              <pre><code className="font-mono text-sm">{selectedTemplate.code}</code></pre>
            </div>
            <footer className="flex-shrink-0 flex justify-end items-center gap-4 pt-4">
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                コピー
              </button>
              <button
                onClick={handleInsert}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                エディタに挿入
              </button>
            </footer>
          </section>
        </main>
      </div>
    </div>
  );
}
