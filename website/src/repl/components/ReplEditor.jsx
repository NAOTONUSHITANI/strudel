import { addHighlight, highlightField } from '@strudel/codemirror/codemirror.mjs';
import { useState, useEffect } from 'react';
import Loader from '@src/repl/components/Loader';
import { HorizontalPanel, VerticalPanel } from '@src/repl/components/panel/Panel';
import { Code } from '@src/repl/components/Code';
import UserFacingErrorMessage from '@src/repl/components/UserFacingErrorMessage';
import { Header } from './Header';
import { useSettings } from '@src/settings.mjs';
import { TemplateSelector } from '@components/TemplateSelector.jsx';
import { Chat } from '@components/Chat.jsx';

function CodeRatioBar({ ratio }) {
  const userRatio = 100 - ratio;
  const aiColor = '#22d3ee'; // Vibrant Cyan
  const userColor = '#d946ef'; // Vibrant Magenta

  const glowStyle = (color) => ({
    boxShadow: `0 0 2px ${color}, 0 0 5px ${color}80, 0 0 10px ${color}60`,
    textShadow: `0 0 2px ${color}80`,
  });

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 text-xs bg-black/50 backdrop-blur-sm border-t border-cyan-500/20">
      <div className="w-24 font-mono text-cyan-300" style={glowStyle(aiColor)}>Code Ratio</div>
      <div className="flex-grow h-2.5 bg-black/30 rounded-full overflow-hidden flex">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${ratio}%`,
            backgroundColor: aiColor,
            boxShadow: glowStyle(aiColor).boxShadow,
          }}
          title={`AI: ${ratio.toFixed(1)}%`}
        />
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${userRatio}%`,
            backgroundColor: userColor,
            boxShadow: glowStyle(userColor).boxShadow,
          }}
          title={`User: ${userRatio.toFixed(1)}%`}
        />
      </div>
      <div className="w-48 font-mono text-right">
        <span style={{ color: aiColor, textShadow: glowStyle(aiColor).textShadow }}>
          AI: {ratio.toFixed(1)}%
        </span>
        <span className="mx-2 text-gray-500">|</span>
        <span style={{ color: userColor, textShadow: glowStyle(userColor).textShadow }}>
          User: {userRatio.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export default function ReplEditor(Props) {
  const { context, ...editorProps } = Props;
  const { containerRef, editorRef: contextEditorRef, error, init, pending, view } = context;
  const settings = useSettings();
  const { panelPosition, isZen } = settings;
  const [isTemplateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [isChatVisible, setChatVisible] = useState(false);
  const [codeRatio, setCodeRatio] = useState(0);

  useEffect(() => {
    if (!view) return;

    const updateListener = view.dom.addEventListener('cm-update', (e) => {
      const v = e.detail;
      if (!v.docChanged) return;

      const totalLength = v.state.doc.length;
      if (totalLength === 0) {
        setCodeRatio(0);
        return;
      }

      const decorations = v.state.field(highlightField);
      let aiLength = 0;
      decorations.between(0, totalLength, (from, to) => {
        aiLength += to - from;
      });

      const ratio = (aiLength / totalLength) * 100;
      setCodeRatio(ratio);
    });

    return () => {
      view.dom.removeEventListener('cm-update', updateListener);
    };
  }, [view]);

  const handleOpenTemplateSelector = () => {
    setTemplateSelectorOpen(true);
  };

  const handleToggleChat = () => {
    setChatVisible(prev => !prev);
  };

  const handleInsertCode = (code) => {
    if (!view) {
      console.error('Editor view is not ready for insertion.');
      alert('エディタの準備ができていません。少し待ってからもう一度お試しください。');
      return;
    }
    const editorView = view;
    const state = editorView.state;
    if (!state) {
      console.error('Editor state is not available.');
      alert('エディタの状態が取得できません。ページを再読み込みしてください。');
      return;
    }
    try {
      const { from, to } = state.selection.main;
      const insertFrom = from;
      const insertTo = from + code.length;

      editorView.dispatch({
        changes: { from, to, insert: code },
        effects: addHighlight.of({ from: insertFrom, to: insertTo }),
      });
      editorView.focus();
    } catch (err) {
      console.error('Failed to insert code:', err);
      alert('コードの挿入に失敗しました。もう一度お試しください。');
    }
  };

  const isEditorReady = !!view;

  return (
    <div className="h-full flex flex-col relative" {...editorProps}>
      <Loader active={pending} />
      <Header
        context={context}
        onOpenTemplateSelector={handleOpenTemplateSelector}
        onToggleChat={handleToggleChat}
        isEditorReady={isEditorReady}
      />
      <CodeRatioBar ratio={codeRatio} />
      <div className="grow flex relative overflow-hidden">
        <Code containerRef={containerRef} editorRef={contextEditorRef} init={init} />
        {!isZen && panelPosition === 'right' && <VerticalPanel context={context} />}
      </div>
      <UserFacingErrorMessage error={error} />
      {!isZen && panelPosition === 'bottom' && <HorizontalPanel context={context} />}
      {isTemplateSelectorOpen && (
        <TemplateSelector
          onInsert={handleInsertCode}
          onClose={() => setTemplateSelectorOpen(false)}
        />
      )}
      {isChatVisible && <Chat onInsertCode={handleInsertCode} onClose={() => setChatVisible(false)} />}
    </div>
  );
}
