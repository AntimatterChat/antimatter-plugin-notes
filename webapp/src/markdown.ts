// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

// Converts a note (the JSON of its ProseMirror document, as editor.getJSON() returns it) to
// Markdown.

export type PMMark = {type: string; attrs?: Record<string, unknown>};

export type PMNode = {
    type: string;
    attrs?: Record<string, unknown>;
    content?: PMNode[];
    text?: string;
    marks?: PMMark[];
};

// The order marks are opened in, outermost first. Code is innermost: it can't contain the others.
const markOrder = ['link', 'bold', 'italic', 'strike', 'underline', 'code'];

function sortMarks(marks: PMMark[] = []): PMMark[] {
    return marks.
        filter((m) => markOrder.includes(m.type)).
        sort((a, b) => markOrder.indexOf(a.type) - markOrder.indexOf(b.type));
}

function sameMark(a: PMMark, b: PMMark) {
    return a.type === b.type && (a.type !== 'link' || a.attrs?.href === b.attrs?.href);
}

function openMark(mark: PMMark) {
    switch (mark.type) {
    case 'link': return '[';
    case 'bold': return '**';
    case 'italic': return '*';
    case 'strike': return '~~';
    case 'underline': return '<u>';
    default: return '';
    }
}

function closeMark(mark: PMMark) {
    switch (mark.type) {
    case 'link': return `](${String(mark.attrs?.href || '').replace(/[()\s]/g, encodeURIComponent)})`;
    case 'bold': return '**';
    case 'italic': return '*';
    case 'strike': return '~~';
    case 'underline': return '</u>';
    default: return '';
    }
}

function escapeText(text: string) {
    return text.replace(/[\\`*_[\]~<]/g, '\\$&');
}

function codeSpan(text: string) {
    const longest = Math.max(0, ...(text.match(/`+/g) || []).map((s) => s.length));
    const fence = '`'.repeat(longest + 1);
    const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
    return fence + pad + text + pad + fence;
}

// inline converts the inline content of a block, moving the whitespace at the edges of marks
// outside of them (Markdown doesn't allow "**bold **").
export function inline(nodes: PMNode[] = []): string {
    let out = '';
    let open: PMMark[] = [];
    let pendingSpace = '';

    const closeTo = (keep: number) => {
        while (open.length > keep) {
            out += closeMark(open.pop() as PMMark);
        }
    };

    for (const node of nodes) {
        if (node.type === 'hardBreak') {
            closeTo(0);
            out += pendingSpace.replace(/\s+$/, '') + '\\\n';
            pendingSpace = '';
            continue;
        }
        if (node.type !== 'text' || !node.text) {
            continue;
        }

        const marks = sortMarks(node.marks);
        const isCode = marks.some((m) => m.type === 'code');
        const text = node.text;
        const core = isCode ? text : text.trim();
        if (!core) {
            pendingSpace += text;
            continue;
        }
        const lead = isCode ? '' : text.slice(0, text.length - text.trimStart().length);
        const trail = isCode ? '' : text.slice(text.trimEnd().length);

        // Keep the marks shared with the previous text open
        let keep = 0;
        while (keep < open.length && keep < marks.length && sameMark(open[keep], marks[keep]) && open[keep].type !== 'code') {
            keep++;
        }
        closeTo(keep);
        out += pendingSpace + lead;
        pendingSpace = trail;

        for (const mark of marks.slice(keep)) {
            if (mark.type !== 'code') {
                out += openMark(mark);
                open.push(mark);
            }
        }
        out += isCode ? codeSpan(core) : escapeText(core);
    }
    closeTo(0);
    open = [];
    return out + pendingSpace.replace(/\s+$/, '');
}

// Escapes what would make a paragraph start a heading, a list, a quote...
function escapeBlockStart(text: string) {
    return text.replace(/^(\s*)([#>+-]|\d+[.)])(?=\s|$)/, (_, space, marker) => `${space}\\${marker}`);
}

function indentLines(text: string, first: string, rest: string) {
    return text.split('\n').map((line, i) => {
        if (i === 0) {
            return first + line;
        }
        return line ? rest + line : line;
    }).join('\n');
}

function listItems(node: PMNode, marker: (i: number, item: PMNode) => string): string {
    return (node.content || []).map((item, i) => {
        const m = marker(i, item);
        const body = (item.content || []).map((child) => block(child)).join('\n');
        return indentLines(body, m, ' '.repeat(m.length));
    }).join('\n');
}

function block(node: PMNode): string {
    switch (node.type) {
    case 'paragraph':
        return escapeBlockStart(inline(node.content));
    case 'heading': {
        const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
        return '#'.repeat(level) + ' ' + inline(node.content);
    }
    case 'blockquote':
        return blocks(node.content).split('\n').map((line) => (line ? '> ' + line : '>')).join('\n');
    case 'codeBlock': {
        const text = (node.content || []).map((n) => n.text || '').join('');
        const longest = Math.max(2, ...(text.match(/^`+/gm) || []).map((s) => s.length));
        const fence = '`'.repeat(longest + 1);
        const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
        return `${fence}${language}\n${text}\n${fence}`;
    }
    case 'horizontalRule':
        return '---';
    case 'bulletList':
        return listItems(node, () => '- ');
    case 'orderedList': {
        const start = Number(node.attrs?.start) || 1;
        return listItems(node, (i) => `${start + i}. `);
    }
    case 'taskList':
        return listItems(node, (i, item) => (item.attrs?.checked ? '- [x] ' : '- [ ] '));
    default:
        return node.content ? blocks(node.content) : inline([node]);
    }
}

function blocks(nodes: PMNode[] = []): string {
    return nodes.map(block).join('\n\n');
}

// toMarkdown converts a note to Markdown, with its title as the top heading.
export function toMarkdown(doc: PMNode, title?: string): string {
    const body = blocks(doc.content).replace(/\n{3,}/g, '\n\n').trim();
    const heading = title ? `# ${escapeText(title)}\n\n` : '';
    return heading + body + '\n';
}
