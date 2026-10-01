// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Editor} from '../note_session';
import type {SyncStatus} from '../relay/connection';
import {cx, isFusionUI} from '../ui/web_ui';

import {useDisplayName} from './hooks';

function EditorChip({editor}: {editor: Editor}) {
    const name = useDisplayName(editor.userId) || editor.name;
    const style = {[isFusionUI() ? '--am-c' : '--c']: editor.color} as React.CSSProperties;
    return (
        <span
            className={cx('editor-chip')}
            title={name}
        >
            <i style={style}/>
            {editor.self ? (
                <FormattedMessage
                    id='notes.editors.you'
                    defaultMessage='You'
                />
            ) : name}
        </span>
    );
}

function StatusText({status, readOnly}: {status: SyncStatus; readOnly: boolean}) {
    if (readOnly) {
        return (
            <FormattedMessage
                id='notes.status.read_only'
                defaultMessage='Read only'
            />
        );
    }
    switch (status) {
    case 'loading':
        return (
            <FormattedMessage
                id='notes.status.loading'
                defaultMessage='Loading…'
            />
        );
    case 'saving':
        return (
            <FormattedMessage
                id='notes.status.saving'
                defaultMessage='Saving…'
            />
        );
    case 'offline':
        return (
            <FormattedMessage
                id='notes.status.offline'
                defaultMessage='Offline, changes will be saved when back'
            />
        );
    case 'error':
        return (
            <FormattedMessage
                id='notes.status.error'
                defaultMessage='Some changes could not be saved'
            />
        );
    default:
        return (
            <FormattedMessage
                id='notes.status.saved'
                defaultMessage='Saved'
            />
        );
    }
}

// EditorsBar shows who has the note open, and whether the changes are saved.
export default function EditorsBar({editors, status, readOnly}: {editors: Editor[]; status: SyncStatus; readOnly: boolean}) {
    // One chip per person, even with the note open in several windows
    const seen = new Set<string>();
    const people = editors.filter((e) => !seen.has(e.userId) && seen.add(e.userId));
    return (
        <div className={cx('pad-meta')}>
            {people.map((editor) => (
                <EditorChip
                    key={editor.clientId}
                    editor={editor}
                />
            ))}
            <span className={cx('grow')}/>
            <span>
                <StatusText
                    status={status}
                    readOnly={readOnly}
                />
                {people.length > 1 && (
                    <>
                        {' · '}
                        <FormattedMessage
                            id='notes.editors.count'
                            defaultMessage='{count} editing'
                            values={{count: people.length}}
                        />
                    </>
                )}
            </span>
        </div>
    );
}
