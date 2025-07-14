import { useState } from 'react';
import Loader from '@src/repl/components/Loader';
import { HorizontalPanel, VerticalPanel } from '@src/repl/components/panel/Panel';
import { Code } from '@src/repl/components/Code';
import UserFacingErrorMessage from '@src/repl/components/UserFacingErrorMessage';
import { Header } from './Header';
import { useSettings } from '@src/settings.mjs';
import { TemplateSelector } from '@components/TemplateSelector';

// type Props = {
//  context: replcontext,
// }

export default function ReplEditor(Props) {
  const { context, ...editorProps } = Props;
  const { containerRef, editorRef, error, init, pending, view } = context;
  const settings = useSettings();
  const { panelPosition, isZen } = settings;
  const [isTemplateSelectorOpen, setTemplateSelectorOpen] = useState(false);

  const handleInsertTemplate = (code) => {
    if (view) {
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: code },
      });
    }
  };

  return (
    <div className="h-full flex flex-col relative" {...editorProps}>
      <Loader active={pending} />
      <Header context={context} onOpenTemplateSelector={() => setTemplateSelectorOpen(true)} />
      <div className="grow flex relative overflow-hidden">
        <Code containerRef={containerRef} editorRef={editorRef} init={init} />
        {!isZen && panelPosition === 'right' && <VerticalPanel context={context} />}
      </div>
      <UserFacingErrorMessage error={error} />
      {!isZen && panelPosition === 'bottom' && <HorizontalPanel context={context} />}
      {isTemplateSelectorOpen && (
        <TemplateSelector
          onInsert={handleInsertTemplate}
          onClose={() => setTemplateSelectorOpen(false)}
        />
      )}
    </div>
  );
}
