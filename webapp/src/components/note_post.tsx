// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

import {client} from '../client';
import type {Doc} from '../relay/client';
import Icon from '../ui/icon';
import {cx} from '../ui/web_ui';
import {openNote} from '../ui_state';

import RelativeTime from './relative_time';

// The notes of the cards, loaded once per note.
const docs = new Map<string, Promise<Doc | null>>();

function loadDoc(docId: string) {
    let doc = docs.get(docId);
    if (!doc) {
        doc = client.getDoc(docId).catch(() => null);
        docs.set(docId, doc);
        setTimeout(() => docs.delete(docId), 60000);
    }
    return doc;
}

// NotePost is the card of a note shared in a channel.
export default function NotePost({post}: {post: Post}) {
    const docId = String(post.props?.doc_id || '');
    const [doc, setDoc] = useState<Doc | null | undefined>();

    useEffect(() => {
        let cancelled = false;
        if (docId) {
            loadDoc(docId).then((d) => !cancelled && setDoc(d));
        }
        return () => {
            cancelled = true;
        };
    }, [docId]);

    const title = doc?.title || String(post.props?.title || '');
    const available = doc !== null;

    return (
        <div className={cx('card', 'compact', 'notes-card')}>
            <div className={cx('card-author')}>
                <Icon
                    name='pad'
                    size='sm'
                />
                <FormattedMessage
                    id='notes.card.label'
                    defaultMessage='Shared note'
                />
            </div>
            <button
                className={cx('card-title')}
                disabled={!available}
                onClick={() => openNote(docId)}
            >
                {title}
            </button>
            <div className={cx('card-foot')}>
                {doc === null ? (
                    <FormattedMessage
                        id='notes.card.unavailable'
                        defaultMessage='This note was deleted, or you are not a member of its channel.'
                    />
                ) : doc && (
                    <FormattedMessage
                        id='notes.card.edited'
                        defaultMessage='Edited {when}'
                        values={{when: <RelativeTime value={doc.update_at}/>}}
                    />
                )}
            </div>
            {available && (
                <div className={cx('card-actions')}>
                    <button
                        className={cx('primary')}
                        onClick={() => openNote(docId)}
                    >
                        <FormattedMessage
                            id='notes.card.open'
                            defaultMessage='Open note'
                        />
                    </button>
                </div>
            )}
        </div>
    );
}
