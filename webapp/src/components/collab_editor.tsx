// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import {Placeholder} from '@tiptap/extensions';
import {EditorContent, useEditor, useEditorState} from '@tiptap/react';
import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';

import type {default as NoteSession, NoteUser} from '../note_session';
import Icon, {type IconName} from '../ui/icon';
import {cx, isFusionUI} from '../ui/web_ui';

import {baseExtensions} from './extensions';

// renderCaret draws the caret of another editor: the mockup's caret with their name.
function renderCaret(user: Record<string, unknown>) {
    const caret = document.createElement('span');
    caret.className = cx('rcaret');
    caret.style.setProperty(isFusionUI() ? '--am-c' : '--c', String(user.color));
    caret.dataset.name = String(user.name || '');
    return caret;
}

type ToolProps = {
    icon: IconName;
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
};

function Tool({icon, label, active, disabled, onClick}: ToolProps) {
    return (
        <button
            className={cx(active && 'on')}
            title={label}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
        >
            <Icon name={icon}/>
        </button>
    );
}

function Toolbar({editor, editable}: {editor: Editor; editable: boolean}) {
    const {formatMessage} = useIntl();
    const state = useEditorState({
        editor,
        selector: ({editor: e}) => ({
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            strike: e.isActive('strike'),
            heading: e.isActive('heading'),
            bulletList: e.isActive('bulletList'),
            orderedList: e.isActive('orderedList'),
            taskList: e.isActive('taskList'),
        }),
    });
    const run = (fn: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () => fn(editor.chain().focus()).run();

    return (
        <div
            className={cx('pad-tools')}
            role='toolbar'
            aria-label={formatMessage({id: 'notes.toolbar', defaultMessage: 'Formatting'})}
        >
            <Tool
                icon='bold'
                label={formatMessage({id: 'notes.toolbar.bold', defaultMessage: 'Bold'})}
                active={state.bold}
                disabled={!editable}
                onClick={run((c) => c.toggleBold())}
            />
            <Tool
                icon='italic'
                label={formatMessage({id: 'notes.toolbar.italic', defaultMessage: 'Italic'})}
                active={state.italic}
                disabled={!editable}
                onClick={run((c) => c.toggleItalic())}
            />
            <Tool
                icon='strike'
                label={formatMessage({id: 'notes.toolbar.strike', defaultMessage: 'Strikethrough'})}
                active={state.strike}
                disabled={!editable}
                onClick={run((c) => c.toggleStrike())}
            />
            <Tool
                icon='heading'
                label={formatMessage({id: 'notes.toolbar.heading', defaultMessage: 'Heading'})}
                active={state.heading}
                disabled={!editable}
                onClick={run((c) => c.toggleHeading({level: 3}))}
            />
            <Tool
                icon='ul'
                label={formatMessage({id: 'notes.toolbar.bullet_list', defaultMessage: 'Bulleted list'})}
                active={state.bulletList}
                disabled={!editable}
                onClick={run((c) => c.toggleBulletList())}
            />
            <Tool
                icon='ol'
                label={formatMessage({id: 'notes.toolbar.ordered_list', defaultMessage: 'Numbered list'})}
                active={state.orderedList}
                disabled={!editable}
                onClick={run((c) => c.toggleOrderedList())}
            />
            <Tool
                icon='checkbox'
                label={formatMessage({id: 'notes.toolbar.checklist', defaultMessage: 'Checklist item'})}
                active={state.taskList}
                disabled={!editable}
                onClick={run((c) => c.toggleTaskList())}
            />
            <span className={cx('grow')}/>
            <Tool
                icon='undo'
                label={formatMessage({id: 'notes.toolbar.undo', defaultMessage: 'Undo'})}
                disabled={!editable}
                onClick={run((c) => c.undo())}
            />
        </div>
    );
}

type Props = {
    session: NoteSession;
    user: NoteUser;
    editable: boolean;
    onEditor: (editor: Editor | null) => void;
};

// CollabEditor is the rich text editor of a note, bound to its Yjs document, with the carets and
// selections of the other editors.
export default function CollabEditor({session, user, editable, onEditor}: Props) {
    const {formatMessage} = useIntl();
    const editor = useEditor({
        extensions: [
            ...baseExtensions(),
            Placeholder.configure({placeholder: formatMessage({id: 'notes.placeholder', defaultMessage: 'Write something, everyone in the channel sees it live…'})}),
            Collaboration.configure({document: session.ydoc, field: 'default'}),
            CollaborationCaret.configure({provider: session, user, render: renderCaret}),
        ],
        editable,
        shouldRerenderOnTransaction: false,
        editorProps: {
            attributes: {
                class: cx('pad', 'notes-prose'),
                role: 'textbox',
                'aria-multiline': 'true',
                'aria-label': formatMessage({id: 'notes.editor', defaultMessage: 'Shared notes'}),
            },
        },
    }, [session]);

    useEffect(() => {
        if (editor && editor.isEditable !== editable) {
            editor.setEditable(editable);
        }
    }, [editor, editable]);

    useEffect(() => {
        onEditor(editor);
        return () => onEditor(null);
    }, [editor, onEditor]);

    if (!editor) {
        return null;
    }
    return (
        <>
            <Toolbar
                editor={editor}
                editable={editable}
            />
            <EditorContent
                editor={editor}
                className={cx('notes-content')}
            />
        </>
    );
}
