// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import type {Editor, JSONContent} from '@tiptap/core';
import React, {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getChannel, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
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
import {confirmDialog} from './fusion/confirm_dialog';
import EmptyState from './fusion/empty_state';
import {iconTip} from './fusion/tip';
import Menu, {type MenuItem} from './menu';
import NoteHistory from './note_history';
import {NoteToolbar} from './note_toolbar';
import ScopeChip, {FavoriteButton} from './scope';

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

type Props = {
    docId: string;

    // The view it opens on (the note, or its versions), and who to tell when it changes: where the panel is
    initialView?: 'edit' | 'history';
    onViewChange?: (docId: string, view: 'edit' | 'history') => void;
};

// NoteEditor shows an open note: its title and its actions in its toolbar at the top of the panel, the editor under
// its formatting tools, and who's editing.
export default function NoteEditor({docId, initialView = 'edit', onViewChange}: Props) {
    const intl = useIntl();
    const me = useSelector(getCurrentUser);
    const nameSetting = useSelector(getTeammateNameDisplaySetting);
    const user: NoteUser = {userId: me.id, name: displayUsername(me, nameSetting), color: userColor(me.id)};

    const [doc, setDoc] = useState<Doc | null>(null);
    const [docError, setDocError] = useState('');
    const [deleted, setDeleted] = useState(false);
    const [view, setView] = useState<'edit' | 'history'>(initialView);
    const [notice, setNotice] = useState('');
    const editorRef = useRef<Editor | null>(null);
    const onEditor = useCallback((editor: Editor | null) => {
        editorRef.current = editor;
    }, []);
    const {session, error: sessionError} = useSession(docId, user);
    const channel = useSelector((state: GlobalState) => (doc?.channel_id ? getChannel(state, doc.channel_id) : null));
    const currentChannel = useSelector(getCurrentChannel);

    useEffect(() => {
        onViewChange?.(docId, view);
    }, [docId, view, onViewChange]);

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

    // Back to the list, or from the versions to the note: a chevron (the host's header above has the app's icon).
    const back = (
        <button
            type='button'
            className={cx('icon-btn', 'notes-back')}
            {...iconTip(intl.formatMessage({id: 'notes.back', defaultMessage: 'All notes'}))}
            onClick={() => (view === 'history' ? setView('edit') : setOpenDoc(null))}
        >
            <Icon name='chev'/>
        </button>
    );

    const opening = intl.formatMessage({id: 'notes.opening', defaultMessage: 'Opening the note…', description: 'Shown in the Notes panel while a note opens (loads).'});
    const failure = docError || sessionError || (deleted && intl.formatMessage({id: 'notes.deleted', defaultMessage: 'This note was deleted.'}));
    if (failure || !doc || !session) {
        return (
            <div className={cx('pad-wrap')}>
                <NoteToolbar>{back}</NoteToolbar>
                {failure ? (
                    <EmptyState
                        tone='danger'
                        icon={<Icon name='pad'/>}
                        text={failure}
                        classicClassName={cx('notes-error')}
                    />
                ) : (
                    <EmptyState
                        busy={true}
                        text={opening}
                        classicClassName={cx('notes-empty')}
                    />
                )}
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

    // A channel's note is shared in the channel once it has a title; one still untitled can be shared by hand.
    if (doc.channel_id && !doc.shared_post_id && !channel?.delete_at) {
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

    // A personal note that should have been the channel's: it moves there, and is shared.
    const conversation = currentChannel?.type === 'D' || currentChannel?.type === 'G';
    if (!doc.channel_id && currentChannel && !currentChannel.delete_at) {
        items.splice(1, 0, {
            icon: 'forward',
            label: conversation ? intl.formatMessage({id: 'notes.menu.move_conversation', defaultMessage: 'Share in this conversation'}) : intl.formatMessage({id: 'notes.menu.move', defaultMessage: 'Share in ~{channel}'}, {channel: currentChannel.display_name}),
            onClick: async () => {
                try {
                    setDoc(await client.moveDoc(doc.id, currentChannel.id));
                    setNotice(intl.formatMessage({id: 'notes.moved', defaultMessage: 'Shared: everyone in the channel can see and edit it now.'}));
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
            onClick: async () => {
                const yes = await confirmDialog({
                    title: doc.title ? intl.formatMessage({id: 'notes.delete.title', defaultMessage: 'Delete "{title}"?', description: 'Title of the dialog confirming the deletion of a note; {title} is the note\'s title.'}, {title: doc.title}) : intl.formatMessage({id: 'notes.delete.title_untitled', defaultMessage: 'Delete this note?', description: 'Title of the dialog confirming the deletion of a note that has no title.'}),
                    message: intl.formatMessage({id: 'notes.delete.lead', defaultMessage: 'It\'s deleted for everyone. This can\'t be undone.', description: 'Under the title of the dialog confirming the deletion of a note.'}),
                    confirmLabel: intl.formatMessage({id: 'notes.menu.delete', defaultMessage: 'Delete'}),
                    cancelLabel: intl.formatMessage({id: 'notes.delete.cancel', defaultMessage: 'Cancel', description: 'Button of the dialog confirming the deletion of a note: keep the note.'}),
                    danger: true,
                    icon: 'trash',
                });
                if (yes) {
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

    const meta = (
        <EditorsBar
            editors={session.editors()}
            status={session.status}
            readOnly={!editable}
        />
    );

    // The note's toolbar, under the host's header: back, the title, where it's shared, the star and the actions. Under
    // it, one slim row: the formatting tools (for those who can edit), who's editing and whether it's saved.
    return (
        <div className={cx('pad-wrap')}>
            <NoteToolbar>
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
                <ScopeChip
                    doc={doc}
                    compact={true}
                />
                <FavoriteButton doc={doc}/>
                <Menu
                    label={intl.formatMessage({id: 'notes.menu', defaultMessage: 'Note actions'})}
                    items={items}
                />
            </NoteToolbar>
            {notice && (
                <button
                    type='button'
                    className={cx('notes-notice')}
                    onClick={() => setNotice('')}
                >
                    {notice}
                </button>
            )}
            {view === 'history' && (
                <NoteHistory
                    docId={doc.id}
                    canRestore={editable}
                    onRestore={restore}
                />
            )}
            {view === 'edit' && loaded && (
                <CollabEditor
                    session={session}
                    user={user}
                    editable={editable}
                    channelId={doc.channel_id || ''}
                    onEditor={onEditor}
                    meta={meta}
                />
            )}
            {view === 'edit' && !loaded && (
                <>
                    <div className={cx('pad-tools', 'notes-tools-row')}>{meta}</div>
                    <EmptyState
                        busy={true}
                        text={opening}
                        classicClassName={cx('notes-empty')}
                    />
                </>
            )}
        </div>
    );
}
