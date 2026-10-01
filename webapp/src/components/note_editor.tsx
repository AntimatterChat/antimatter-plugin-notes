// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import type {Editor, JSONContent} from '@tiptap/core';
import React, {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import type {GlobalState} from '@mattermost/types/store';

import {client, events, shareNote} from '../client';
import {userColor} from '../colors';
import {toMarkdown, type PMNode} from '../markdown';
import NoteSession, {type NoteUser} from '../note_session';
import type {Doc} from '../relay/client';
import Icon from '../ui/icon';
import {cx} from '../ui/web_ui';
import {setOpenDoc} from '../ui_state';

import CollabEditor from './collab_editor';
import EditorsBar from './editors_bar';
import Menu, {type MenuItem} from './menu';
import NoteHistory from './note_history';

function download(filename: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], {type: 'text/markdown;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileName(title: string) {
    return (title.replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim() || 'note') + '.md';
}

// mergeDoc returns a state update applying changes to a note.
function mergeDoc(changes: Partial<Doc>) {
    return (doc: Doc | null) => (doc ? {...doc, ...changes} : doc);
}

function useSession(docId: string, user: NoteUser) {
    const [session, setSession] = useState<NoteSession | null>(null);
    const [error, setError] = useState('');
    const userRef = useRef(user);
    userRef.current = user;

    useEffect(() => {
        const s = new NoteSession(client, docId);
        const removeListener = events.addDoc(s.connection);
        s.start(userRef.current).catch((err) => setError(err.message));
        setSession(s);
        setError('');

        // Don't lose the last changes when the window closes
        const warn = (e: BeforeUnloadEvent) => {
            if (s.connection.pending()) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', warn);
        return () => {
            window.removeEventListener('beforeunload', warn);
            removeListener();
            s.destroy();
        };
    }, [docId]);

    // Follow the status and the editors of the session
    const subscribe = useCallback((listener: () => void) => (session ? session.subscribe(listener) : () => null), [session]);
    useSyncExternalStore(subscribe, () => session?.version ?? -1);

    return {session, error};
}

function TitleInput({doc, editable}: {doc: Doc; editable: boolean}) {
    const {formatMessage} = useIntl();
    const [title, setTitle] = useState(doc.title);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!focused) {
            setTitle(doc.title);
        }
    }, [doc.title, focused]);

    const save = () => {
        setFocused(false);
        if (title.trim() !== doc.title) {
            client.renameDoc(doc.id, title).catch(() => setTitle(doc.title));
        }
    };

    return (
        <input
            className={cx('notes-title')}
            value={title}
            readOnly={!editable}
            maxLength={200}
            aria-label={formatMessage({id: 'notes.title', defaultMessage: 'Title'})}
            onFocus={() => setFocused(true)}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                    setTitle(doc.title);
                }
            }}
        />
    );
}

// NoteEditor shows an open note: its title, who's editing, the editor, and its actions.
export default function NoteEditor({docId}: {docId: string}) {
    const intl = useIntl();
    const me = useSelector(getCurrentUser);
    const nameSetting = useSelector(getTeammateNameDisplaySetting);
    const user: NoteUser = {userId: me.id, name: displayUsername(me, nameSetting), color: userColor(me.id)};

    const [doc, setDoc] = useState<Doc | null>(null);
    const [docError, setDocError] = useState('');
    const [deleted, setDeleted] = useState(false);
    const [view, setView] = useState<'edit' | 'history'>('edit');
    const [notice, setNotice] = useState('');
    const editorRef = useRef<Editor | null>(null);
    const onEditor = useCallback((editor: Editor | null) => {
        editorRef.current = editor;
    }, []);
    const {session, error: sessionError} = useSession(docId, user);
    const channel = useSelector((state: GlobalState) => (doc?.channel_id ? getChannel(state, doc.channel_id) : null));

    useEffect(() => {
        client.getDoc(docId).then(setDoc, (err) => setDocError(err.status === 404 ? intl.formatMessage({id: 'notes.not_found', defaultMessage: 'This note was deleted, or you can\'t open it.'}) : err.message));
    }, [docId, intl]);

    // Follow the renames and the deletion of the note
    useEffect(() => events.addListListener((change) => {
        if (change.doc.id !== docId) {
            return;
        }
        if (change.event === 'deleted') {
            setDeleted(true);
        } else {
            setDoc(mergeDoc(change.doc));
        }
    }), [docId]);

    const back = (
        <button
            className={cx('icon-btn')}
            title={intl.formatMessage({id: 'notes.back', defaultMessage: 'All notes'})}
            aria-label={intl.formatMessage({id: 'notes.back', defaultMessage: 'All notes'})}
            onClick={() => (view === 'history' ? setView('edit') : setOpenDoc(null))}
        >
            <Icon name='chev'/>
        </button>
    );

    const failure = docError || sessionError || (deleted && intl.formatMessage({id: 'notes.deleted', defaultMessage: 'This note was deleted.'}));
    if (failure || !doc || !session) {
        return (
            <div className={cx('pad-wrap')}>
                <div className={cx('notes-bar')}>{back}</div>
                <div className={failure ? cx('notes-error') : cx('notes-empty')}>{failure || '…'}</div>
            </div>
        );
    }

    const editable = doc.can_edit && !session.readOnly;
    const loaded = session.status !== 'loading';

    const items: MenuItem[] = [
        {
            icon: 'export',
            label: intl.formatMessage({id: 'notes.menu.export', defaultMessage: 'Export as Markdown'}),
            onClick: () => {
                const json = editorRef.current?.getJSON();
                if (json) {
                    download(fileName(doc.title), toMarkdown(json as PMNode, doc.title));
                }
            },
        },
        {
            icon: 'clock',
            label: intl.formatMessage({id: 'notes.menu.history', defaultMessage: 'Version history'}),
            onClick: () => setView('history'),
        },
    ];
    if (doc.channel_id && !channel?.delete_at) {
        items.splice(1, 0, {
            icon: 'forward',
            label: intl.formatMessage({id: 'notes.menu.share', defaultMessage: 'Share in the channel'}),
            onClick: async () => {
                try {
                    await shareNote(doc.id);
                    setNotice(intl.formatMessage({id: 'notes.shared', defaultMessage: 'Shared in the channel.'}));
                } catch (err) {
                    setNotice((err as Error).message);
                }
            },
        });
    }
    if (doc.can_delete) {
        items.push({
            icon: 'trash',
            label: intl.formatMessage({id: 'notes.menu.delete', defaultMessage: 'Delete'}),
            danger: true,
            onClick: () => {
                // eslint-disable-next-line no-alert
                if (window.confirm(intl.formatMessage({id: 'notes.delete.confirm', defaultMessage: 'Delete "{title}" for everyone? This can\'t be undone.'}, {title: doc.title}))) {
                    client.deleteDoc(doc.id).then(() => setOpenDoc(null), (err) => setNotice(err.message));
                }
            },
        });
    }

    const restore = (content: JSONContent) => {
        editorRef.current?.commands.setContent(content);
        setView('edit');
        setNotice(intl.formatMessage({id: 'notes.restored', defaultMessage: 'Version restored. Undo to go back.'}));
    };

    return (
        <div className={cx('pad-wrap')}>
            <div className={cx('notes-bar')}>
                {back}
                {view === 'history' ? (
                    <span className={cx('notes-title')}>
                        <FormattedMessage
                            id='notes.history.title'
                            defaultMessage='Versions of {title}'
                            values={{title: doc.title}}
                        />
                    </span>
                ) : (
                    <TitleInput
                        doc={doc}
                        editable={editable}
                    />
                )}
                <Menu
                    label={intl.formatMessage({id: 'notes.menu', defaultMessage: 'Note actions'})}
                    items={items}
                />
            </div>
            {notice && (
                <button
                    className={cx('notes-notice')}
                    onClick={() => setNotice('')}
                >
                    {notice}
                </button>
            )}
            {view === 'history' ? (
                <NoteHistory
                    docId={doc.id}
                    canRestore={editable}
                    onRestore={restore}
                />
            ) : (
                <>
                    <EditorsBar
                        editors={session.editors()}
                        status={session.status}
                        readOnly={!editable}
                    />
                    {loaded ? (
                        <CollabEditor
                            session={session}
                            user={user}
                            editable={editable}
                            channelId={doc.channel_id || ''}
                            onEditor={onEditor}
                        />
                    ) : <div className={cx('notes-empty')}>{'…'}</div>}
                </>
            )}
        </div>
    );
}
