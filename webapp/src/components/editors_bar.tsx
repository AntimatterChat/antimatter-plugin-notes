// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Editor} from '../note_session';
import type {SyncStatus} from '../relay/connection';
import {cx, isFusionUI} from '../ui/web_ui';

import {useDisplayName} from './hooks';
import {useSteadyStatus} from './steady_status';

// EditorDot is someone who has the note open: a dot in their caret's colour, with their initial and their name as its
// tooltip.
function EditorDot({editor}: {editor: Editor}) {
    const intl = useIntl();
    const name = useDisplayName(editor.userId) || editor.name;
    const style = {[isFusionUI() ? '--am-c' : '--c']: editor.color} as React.CSSProperties;
    const label = editor.self ? intl.formatMessage({id: 'notes.editors.you', defaultMessage: 'You'}) : name;
    return (
        <span
            className={cx('editor-dot')}
            style={style}
            title={label}
            aria-label={label}
            role='img'
        >
            {(name || '?').charAt(0).toUpperCase()}
        </span>
    );
}

function StatusText({status, readOnly}: {status: SyncStatus; readOnly: boolean}) {
    const steady = useSteadyStatus(status);
    if (readOnly) {
        return (
            <FormattedMessage
                id='notes.status.read_only'
                defaultMessage='Read only'
            />
        );
    }
    switch (steady) {
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

// The most people shown as dots: the others are counted.
const MAX_DOTS = 4;

// EditorsBar tells, at the end of the note's toolbar, who else has the note open and whether the changes are
// saved.
export default function EditorsBar({editors, status, readOnly}: {editors: Editor[]; status: SyncStatus; readOnly: boolean}) {
    const intl = useIntl();

    // One dot per person, even with the note open in several windows; you first
    const seen = new Set<string>();
    const people = editors.filter((e) => !seen.has(e.userId) && seen.add(e.userId)).sort((a, b) => Number(b.self) - Number(a.self));
    return (
        <span className={cx('notes-meta')}>
            {people.length > 1 && (
                <span
                    className={cx('editor-dots')}
                    role='group'
                    aria-label={intl.formatMessage({id: 'notes.editors.count', defaultMessage: '{count} editing'}, {count: people.length})}
                >
                    {people.slice(0, MAX_DOTS).map((editor) => (
                        <EditorDot
                            key={editor.clientId}
                            editor={editor}
                        />
                    ))}
                    {people.length > MAX_DOTS && <span className={cx('editor-dot', 'editor-more')}>{`+${people.length - MAX_DOTS}`}</span>}
                </span>
            )}
            <span
                className={cx('notes-status')}
                role='status'
            >
                <StatusText
                    status={status}
                    readOnly={readOnly}
                />
            </span>
        </span>
    );
}
