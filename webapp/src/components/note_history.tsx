// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import type {JSONContent} from '@tiptap/core';
import {EditorContent, useEditor} from '@tiptap/react';
import {yDocToProsemirrorJSON} from '@tiptap/y-tiptap';
import React, {useEffect, useState} from 'react';
import {FormattedDate, FormattedMessage, FormattedTime, useIntl} from 'react-intl';
import * as Y from 'yjs';

import {client} from '../client';
import type {Version} from '../relay/client';
import Icon from '../ui/icon';
import {cx} from '../ui/web_ui';

import {baseExtensions} from './extensions';
import EmptyState from './fusion/empty_state';

// versionContent returns the content of a past version of a note (a Yjs snapshot).
export function versionContent(data: Uint8Array): JSONContent {
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, data);
    const content = yDocToProsemirrorJSON(ydoc, 'default') as JSONContent;
    ydoc.destroy();
    return content;
}

function Preview({content}: {content: JSONContent}) {
    const editor = useEditor({
        extensions: baseExtensions(),
        content,
        editable: false,
        editorProps: {attributes: {class: cx('pad', 'notes-prose')}},
    }, [content]);
    return (
        <EditorContent
            editor={editor}
            className={cx('notes-content')}
        />
    );
}

type Props = {
    docId: string;
    canRestore: boolean;
    onRestore: (content: JSONContent) => void;
};

// NoteHistory lists the past versions of a note, shows them and restores them.
export default function NoteHistory({docId, canRestore, onRestore}: Props) {
    const intl = useIntl();
    const [versions, setVersions] = useState<Version[] | null>(null);
    const [selected, setSelected] = useState<number | null>(null);
    const [content, setContent] = useState<JSONContent | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        client.getVersions(docId).then((v) => setVersions([...v].reverse()), (err) => setError(err.message));
    }, [docId]);

    useEffect(() => {
        setContent(null);
        if (selected === null) {
            return;
        }

        // A malformed version throws when decoded, caught as well
        client.getVersion(docId, selected).then((data) => setContent(versionContent(data))).catch((err) => setError(err.message));
    }, [docId, selected]);

    if (error) {
        return <div className={cx('notes-error')}>{error}</div>;
    }
    if (!versions) {
        return (
            <EmptyState
                busy={true}
                text={intl.formatMessage({id: 'notes.history.loading', defaultMessage: 'Loading the versions…', description: 'Shown in a note\'s version history while its past versions load.'})}
                classicClassName={cx('notes-empty')}
            />
        );
    }
    if (!versions.length) {
        return (
            <EmptyState
                icon={<Icon name='clock'/>}
                title={intl.formatMessage({id: 'notes.history.empty_title', defaultMessage: 'No past versions yet', description: 'Title of a note\'s version history when it has no past versions.'})}
                text={intl.formatMessage({id: 'notes.history.empty_text', defaultMessage: 'Versions are kept every 10 minutes or so while a note is edited.', description: 'Under "No past versions yet" in a note\'s version history: when versions are kept.'})}
                classicClassName={cx('notes-empty')}
            />
        );
    }

    return (
        <div className={cx('notes-history')}>
            <div className={cx('notes-versions')}>
                {versions.map((v) => (
                    <button
                        key={v.seq}
                        className={cx('notes-version', selected === v.seq && 'on')}
                        onClick={() => setSelected(v.seq)}
                    >
                        <FormattedDate
                            value={v.at}
                            month='short'
                            day='numeric'
                        />
                        {' '}
                        <FormattedTime value={v.at}/>
                    </button>
                ))}
            </div>
            {content && (
                <>
                    <Preview content={content}/>
                    {canRestore && (
                        <div className={cx('notes-history-actions')}>
                            <button
                                className={cx('btn', 'primary')}
                                onClick={() => onRestore(content)}
                            >
                                <FormattedMessage
                                    id='notes.history.restore'
                                    defaultMessage='Restore this version'
                                />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
