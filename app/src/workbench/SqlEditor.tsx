// CodeMirror 6 editor for SQL. Monaco is not used: it does not support mobile browsers.
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { sql, PostgreSQL } from '@codemirror/lang-sql'
import { HighlightStyle, syntaxHighlighting, bracketMatching } from '@codemirror/language'
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, keymap, lineNumbers, drawSelection, type DecorationSet } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

export interface EditorHandle {
  insert(text: string): void
  focus(): void
  /** The selected text if there is a selection, otherwise everything, with its offset in the document. */
  selectionOrAll(): { text: string; offset: number }
}

const theme = EditorView.theme(
  {
    '&': { color: 'var(--ed-text)', backgroundColor: 'var(--ed-bg)', fontSize: '16px' },
    '.cm-content': { fontFamily: 'var(--mono)', padding: '12px 0', caretColor: '#f26b3a', lineHeight: '1.75' },
    '.cm-scroller': { fontFamily: 'var(--mono)', overflow: 'auto' },
    '.cm-gutters': { backgroundColor: 'var(--ed-bg)', color: 'var(--ed-gutter)', border: 'none', paddingLeft: '6px' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 14px 0 4px', minWidth: '28px' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-cursor': { borderLeftColor: '#f26b3a', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#3b3550 !important' },
    '.cm-matchingBracket': { backgroundColor: '#333', color: 'inherit' },
    '.cm-error-mark': { textDecoration: 'underline wavy #f26b3a', textDecorationSkipInk: 'none', textUnderlineOffset: '4px' },
  },
  { dark: true },
)

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.bool, t.null], color: 'var(--ed-kw)' },
  { tag: [t.function(t.variableName), t.standard(t.name)], color: 'var(--ed-fn)' },
  { tag: [t.number, t.typeName], color: 'var(--ed-num)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--ed-str)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--ed-com)', fontStyle: 'italic' },
])

const setError = StateEffect.define<{ from: number; to: number } | null>()
const errorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setError)) return e.value ? Decoration.set([Decoration.mark({ class: 'cm-error-mark' }).range(e.value.from, e.value.to)]) : Decoration.none
    }
    return tr.docChanged ? Decoration.none : deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

interface Props {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  /** PostgreSQL's 1-based character position of an error, relative to the text that was run. */
  errorPosition?: number | null
  /** Offset of the run text within the document (when a selection was run). */
  errorOffset?: number
  label: string
  ref?: Ref<EditorHandle>
}

export function SqlEditor({ value, onChange, onRun, errorPosition, errorOffset = 0, label, ref }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const handlers = useRef({ onChange, onRun })
  useEffect(() => {
    handlers.current = { onChange, onRun }
  })

  useEffect(() => {
    if (!host.current) return
    const extensions: Extension[] = [
      lineNumbers(),
      history(),
      drawSelection(),
      bracketMatching(),
      sql({ dialect: PostgreSQL, upperCaseKeywords: true }),
      syntaxHighlighting(highlight),
      theme,
      errorField,
      keymap.of([
        { key: 'Mod-Enter', run: () => { handlers.current.onRun(); return true } },
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.updateListener.of((u) => { if (u.docChanged) handlers.current.onChange(u.state.doc.toString()) }),
      EditorView.contentAttributes.of({ 'aria-label': label, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
    ]
    view.current = new EditorView({ parent: host.current, state: EditorState.create({ doc: value, extensions }) })
    return () => {
      view.current?.destroy()
      view.current = null
    }
    // The editor is created once; later value changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply value changes that did not come from typing (a new challenge, a lesson block).
  useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
  }, [value])

  useEffect(() => {
    const v = view.current
    if (!v) return
    if (!errorPosition) {
      v.dispatch({ effects: setError.of(null) })
      return
    }
    const from = Math.min(v.state.doc.length, Math.max(0, errorOffset + errorPosition - 1))
    const line = v.state.doc.lineAt(from)
    const wordEnd = Math.min(line.to, from + Math.max(1, /^\w*/.exec(v.state.sliceDoc(from, line.to))?.[0].length ?? 1))
    v.dispatch({ effects: setError.of({ from, to: Math.max(from + 1, wordEnd) }), selection: { anchor: from } })
  }, [errorPosition, errorOffset])

  useImperativeHandle(ref, () => ({
    insert(text: string) {
      const v = view.current
      if (!v) return
      const { from, to } = v.state.selection.main
      v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
      v.focus()
    },
    focus() { view.current?.focus() },
    selectionOrAll() {
      const v = view.current
      if (!v) return { text: value, offset: 0 }
      const { from, to } = v.state.selection.main
      return from === to ? { text: v.state.doc.toString(), offset: 0 } : { text: v.state.sliceDoc(from, to), offset: from }
    },
  }), [value])

  return <div ref={host} className="ed" style={{ minHeight: 180 }} />
}
