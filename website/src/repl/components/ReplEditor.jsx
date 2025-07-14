import { useState, useRef, useEffect } from 'react';
import Loader from '@src/repl/components/Loader';
import { HorizontalPanel, VerticalPanel } from '@src/repl/components/panel/Panel';
import { Code } from '@src/repl/components/Code';
import UserFacingErrorMessage from '@src/repl/components/UserFacingErrorMessage';
import { Header } from './Header';
import { useSettings } from '@src/settings.mjs';
import { TemplateSelector } from '@components/TemplateSelector';
import { Chat } from '@components/Chat';

export default function ReplEditor(Props) {
  const { context, ...editorProps } = Props;
  const { containerRef, editorRef: contextEditorRef, error, init, pending, view } = context;
  const settings = useSettings();
  const { panelPosition, isZen } = settings;
  const [isTemplateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  
  // このコンポーネント専用のrefを作成し、contextのviewを監視して更新する
  const viewRef = useRef(null);
  useEffect(() => {
    if (view) {
      viewRef.current = view;
    }
  }, [view]);

  const handleInsertCode = (code) => {
    const editorView = viewRef.current;
    if (editorView && editorView.state) {
      const { from, to } = editorView.state.selection.main;
      editorView.dispatch({
        changes: { from, to, insert: code },
      });
      editorView.focus();
    } else {
      console.error('Editor view is not ready for insertion.');
      alert('エディタの準備ができていません。少し待ってからもう一度お試しください。');
    }
  };

  return (
    <div className="h-full flex flex-col relative" {...editorProps}>
      <Loader active={pending} />
      <Header context={context} onOpenTemplateSelector={() => setTemplateSelectorOpen(true)} />
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
      <Chat onInsertCode={handleInsertCode} />
    </div>
  );
}
