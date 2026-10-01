// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {inline, toMarkdown, type PMNode} from './markdown';

const text = (t: string, ...marks: string[]): PMNode => ({type: 'text', text: t, marks: marks.map((type) => ({type}))});
const p = (...content: PMNode[]): PMNode => ({type: 'paragraph', content});
const item = (...content: PMNode[]): PMNode => ({type: 'listItem', content});

describe('inline', () => {
    test('wraps marks and keeps shared marks open', () => {
        expect(inline([text('a', 'bold'), text('b', 'bold', 'italic'), text(' c')])).toBe('**a*b*** c');
    });

    test('moves whitespace out of marks', () => {
        expect(inline([text('Hello '), text('big ', 'bold'), text('world')])).toBe('Hello **big** world');
        expect(inline([text(' x ', 'italic')])).toBe(' *x*');
    });

    test('escapes Markdown characters but not in code', () => {
        expect(inline([text('2*3 = [6] '), text('a*b', 'code')])).toBe('2\\*3 = \\[6\\] `a*b`');
        expect(inline([text('use `x`', 'code')])).toBe('`` use `x` ``');
    });

    test('writes links and hard breaks', () => {
        const link = {type: 'text', text: 'docs', marks: [{type: 'link', attrs: {href: 'https://example.com/a b'}}]};
        expect(inline([text('see '), link, {type: 'hardBreak'}, text('next')])).toBe('see [docs](https://example.com/a%20b)\\\nnext');
    });
});

describe('mentions', () => {
    const mention = (label: string, ...marks: string[]): PMNode => ({type: 'mention', attrs: {id: 'u1', label}, marks: marks.map((type) => ({type}))});

    test('are written as in messages', () => {
        expect(inline([text('Ask '), mention('ada.lovelace'), text(' or '), mention('kenji_t'), text('.')])).toBe('Ask @ada.lovelace or @kenji_t.');
    });

    test('keep their marks and only the characters of usernames', () => {
        expect(inline([mention('ada', 'bold'), text(' ok')])).toBe('**@ada** ok');
        expect(inline([mention('ada](x) *')])).toBe('@adax');
    });
});

describe('toMarkdown', () => {
    test('converts a note', () => {
        const doc: PMNode = {
            type: 'doc',
            content: [
                {type: 'heading', attrs: {level: 2}, content: [text('Plan')]},
                p(text('Goal: '), text('ship', 'bold'), text('.')),
                {
                    type: 'bulletList',
                    content: [
                        item(p(text('one'))),
                        item(p(text('two')), {type: 'bulletList', content: [item(p(text('nested')))]}),
                    ],
                },
                {type: 'orderedList', attrs: {start: 3}, content: [item(p(text('third'))), item(p(text('fourth')))]},
                {
                    type: 'taskList',
                    content: [
                        {type: 'taskItem', attrs: {checked: true}, content: [p(text('done'))]},
                        {type: 'taskItem', attrs: {checked: false}, content: [p(text('todo'))]},
                    ],
                },
                {type: 'blockquote', content: [p(text('quoted')), p(text('twice'))]},
                {type: 'codeBlock', attrs: {language: 'go'}, content: [text('fmt.Println("hi")')]},
                {type: 'horizontalRule'},
                p(text('# not a heading')),
                p(),
            ],
        };
        expect(toMarkdown(doc, 'Run 43')).toBe(`# Run 43

## Plan

Goal: **ship**.

- one
- two
  - nested

3. third
4. fourth

- [x] done
- [ ] todo

> quoted
>
> twice

\`\`\`go
fmt.Println("hi")
\`\`\`

---

\\# not a heading
`);
    });

    test('handles an empty note', () => {
        expect(toMarkdown({type: 'doc', content: [p()]})).toBe('\n');
    });
});
