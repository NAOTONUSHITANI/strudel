/*
Repl.jsx - <short description TODO>
Copyright (C) 2022 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/repl/src/App.js>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { useState, useEffect } from 'react';
import { isIframe, isUdels } from './util.mjs';
import UdelsEditor from '@components/Udels/UdelsEditor.jsx';
import ReplEditor from './components/ReplEditor.jsx';
import EmbeddedReplEditor from './components/EmbeddedReplEditor.jsx';
import { useReplContext } from './useReplContext.jsx';
import { useSettings } from '@src/settings.mjs';

export function Repl({ embedded = false }) {
  // サーバーでは安全な初期値を使用し、クライアントで判定結果を保持する
  const [Editor, setEditor] = useState(() => ReplEditor); // 初期エディタをデフォルトに

  const context = useReplContext();
  const { fontFamily } = useSettings();

  // クライアントサイドでのみ実行
  useEffect(() => {
    const embeddedCheck = embedded || isIframe();
    const editorComponent = isUdels() ? UdelsEditor : embeddedCheck ? EmbeddedReplEditor : ReplEditor;
    setEditor(() => editorComponent);
  }, [embedded]);

  return (
    <>
      <Editor
        context={context}
        style={{ fontFamily }}
      />
    </>
  );
}