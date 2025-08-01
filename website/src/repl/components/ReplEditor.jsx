import { addHighlight } from '@strudel/codemirror/codemirror.mjs';
import { useState } from 'react';
import Loader from '@src/repl/components/Loader';
import { HorizontalPanel, VerticalPanel } from '@src/repl/components/panel/Panel';
import { Code } from '@src/repl/components/Code';
import UserFacingErrorMessage from '@src/repl/components/UserFacingErrorMessage';
import { Header } from './Header';
import { useSettings } from '@src/settings.mjs';
import { TemplateSelector } from '@components/TemplateSelector.jsx';
import { Chat } from '@components/Chat.jsx';

export default function ReplEditor(Props) {
  const { context, ...editorProps } = Props;
  const { containerRef, editorRef: contextEditorRef, error, init, pending, view } = context;
  const settings = useSettings();
  const { panelPosition, isZen } = settings;
  const [isTemplateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [isChatVisible, setChatVisible] = useState(false);

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
