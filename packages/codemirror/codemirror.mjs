import { closeBrackets } from '@codemirror/autocomplete';
// import { search, highlightSelectionMatches } from '@codemirror/search';
import { history } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, highlightActiveLineGutter, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { Pattern, Drawer, repl, cleanupDraw } from '@strudel.cycles/core';
import { isAutoCompletionEnabled } from './Autocomplete';
import { flash, isFlashEnabled } from './flash.mjs';
import { highlightMiniLocations, isPatternHighlightingEnabled, updateMiniLocations } from './highlight.mjs';
import { keybindings } from './keybindings.mjs';
import { theme } from './themes.mjs';

const extensions = {
  isLineWrappingEnabled: (on) => (on ? EditorView.lineWrapping : []),
  isLineNumbersDisplayed: (on) => (on ? lineNumbers() : []),
  theme,
  isAutoCompletionEnabled,
  isPatternHighlightingEnabled,
  isFlashEnabled,
  keybindings,
};
const compartments = Object.fromEntries(Object.keys(extensions).map((key) => [key, new Compartment()]));

// https://codemirror.net/docs/guide/
export function initEditor({ initialCode = '', onChange, onEvaluate, onStop, settings, root }) {
  const initialSettings = Object.keys(compartments).map((key) =>
    compartments[key].of(extensions[key](parseBooleans(settings[key]))),
  );
  console.log('settings', settings);
  let state = EditorState.create({
    doc: initialCode,
    extensions: [
      /* search(),
      highlightSelectionMatches(), */
      ...initialSettings,
      javascript(),
      // indentOnInput(), // works without. already brought with javascript extension?
      // bracketMatching(), // does not do anything
      closeBrackets(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      syntaxHighlighting(defaultHighlightStyle),
      history(),
      EditorView.updateListener.of((v) => onChange(v)),
      keymap.of([
        {
          key: 'Ctrl-Enter',
          run: () => onEvaluate?.(),
        },
        {
          key: 'Alt-Enter',
          run: () => onEvaluate?.(),
        },
        {
          key: 'Ctrl-.',
          run: () => onStop?.(),
        },
        {
          key: 'Alt-.',
          run: (_, e) => {
            e.preventDefault();
            onStop?.();
          },
        },
        /* {
          key: 'Ctrl-Shift-.',
          run: () => (onPanic ? onPanic() : onStop?.()),
        },
        {
          key: 'Ctrl-Shift-Enter',
          run: () => (onReEvaluate ? onReEvaluate() : onEvaluate?.()),
        }, */
      ]),
    ],
  });

  return new EditorView({
    state,
    parent: root,
  });
}

export class StrudelMirror {
  constructor(options) {
    const { root, initialCode = '', onDraw, drawTime = [-2, 2], prebake, settings, ...replOptions } = options;
    this.code = initialCode;
    this.root = root;
    this.miniLocations = [];
    this.painters = [];
    const self = this;

    this.drawer = new Drawer((haps, time) => {
      const currentFrame = haps.filter((hap) => time >= hap.whole.begin && time <= hap.endClipped);
      this.highlight(currentFrame, time);
      onDraw?.(haps, time, currentFrame, this.painters);
    }, drawTime);

    Pattern.prototype.onPaint = function (onPaint) {
      self.painters.push(onPaint);
      return this;
    };

    const prebaked = prebake();
    prebaked.then(async () => {
      if (!onDraw) {
        return;
      }
      // draw first frame instantly
      prebaked.then(async () => {
        await this.repl.evaluate(this.code, false);
        this.drawer.invalidate(this.repl.scheduler);
        onDraw?.(this.drawer.visibleHaps, 0, []);
      });
    });

    this.repl = repl({
      ...replOptions,
      onToggle: (started) => {
        replOptions?.onToggle?.(started);
        if (started) {
          this.drawer.start(this.repl.scheduler);
        } else {
          this.drawer.stop();
          updateMiniLocations(this.editor, []);
          cleanupDraw(false);
        }
      },
      beforeEval: async () => {
        cleanupDraw();
        this.painters = [];
        await prebaked;
        await replOptions?.beforeEval?.();
      },
      afterEval: (options) => {
        // remember for when highlighting is toggled on
        this.miniLocations = options.meta?.miniLocations;
        updateMiniLocations(this.editor, this.miniLocations);
        replOptions?.afterEval?.(options);
        this.drawer.invalidate();
      },
    });
    this.editor = initEditor({
      root,
      settings,
      initialCode,
      onChange: (v) => {
        if (v.docChanged) {
          this.code = v.state.doc.toString();
          this.repl.setCode(this.code);
        }
      },
      onEvaluate: () => this.evaluate(),
      onStop: () => this.stop(),
    });
  }
  async evaluate() {
    this.flash();
    await this.repl.evaluate(this.code);
  }
  async stop() {
    this.repl.scheduler.stop();
  }
  async toggle() {
    if (this.repl.scheduler.started) {
      this.repl.scheduler.stop();
    } else {
      this.evaluate();
    }
  }
  flash(ms) {
    flash(this.editor, ms);
  }
  highlight(haps, time) {
    highlightMiniLocations(this.editor, time, haps);
  }
  setFontSize(size) {
    this.root.style.fontSize = size + 'px';
  }
  setFontFamily(family) {
    this.root.style.fontFamily = family;
  }
  reconfigureExtension(key, value) {
    if (!extensions[key]) {
      console.warn(`extension ${key} is not known`);
      return;
    }
    value = parseBooleans(value);
    const newValue = extensions[key](value, this);
    this.editor.dispatch({
      effects: compartments[key].reconfigure(newValue),
    });
  }
  setLineWrappingEnabled(enabled) {
    this.reconfigureExtension('isLineWrappingEnabled', enabled);
  }
  setLineNumbersDisplayed(enabled) {
    this.reconfigureExtension('isLineNumbersDisplayed', enabled);
  }
  setTheme(theme) {
    this.reconfigureExtension('theme', theme);
  }
  setAutocompletionEnabled(enabled) {
    this.reconfigureExtension('isAutoCompletionEnabled', enabled);
  }
  updateSettings(settings) {
    this.setFontSize(settings.fontSize);
    this.setFontFamily(settings.fontFamily);
    for (let key in extensions) {
      this.reconfigureExtension(key, settings[key]);
    }
  }
  changeSetting(key, value) {
    if (extensions[key]) {
      this.reconfigureExtension(key, value);
      return;
    } else if (key === 'fontFamily') {
      this.setFontFamily(value);
    } else if (key === 'fontSize') {
      this.setFontSize(value);
    }
  }
  setCode(code) {
    const changes = { from: 0, to: this.editor.state.doc.length, insert: code };
    this.editor.dispatch({ changes });
  }
}

function parseBooleans(value) {
  return { true: true, false: false }[value] ?? value;
}
