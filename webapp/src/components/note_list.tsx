// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {client, events} from '../client';
import type {Doc} from '../relay/client';
import Icon from '../ui/icon';
import {cx} from '../ui/web_ui';
import {setListView, setOpenDoc, useListView} from '../ui_state';

import {useDisplayName} from './hooks';
import RelativeTime from './relative_time';
import ScopeChip from './scope';

// showScope tells where it's shared (or that it's personal), in the favorites, which mix them.
function NoteRow({doc, showScope = false}: {doc: Doc; showScope?: boolean}) {
    const editor = useDisplayName(doc.updated_by || doc.creator_id);
    return (
        <button
            className={cx('app-row')}
            onClick={() => setOpenDoc(doc.id)}
        >
            <span className={cx('notes-row-ic', !doc.channel_id && 'notes-row-personal')}>
                <Icon name='pad'/>
                {!doc.channel_id && (
                    <span className={cx('notes-row-lock')}>
                        <Icon
                            name='lock'
                            size='xs'
                        />
                    </span>
                )}
            </span>
            <span className={cx('notes-row-main')}>
                <b>{doc.title}</b>
                <span className={cx('sub')}>
                    <FormattedMessage
                        id='notes.list.edited'
                        defaultMessage='Edited {when} by {name}'
                        values={{when: <RelativeTime value={doc.update_at}/>, name: editor || '…'}}
                    />
                </span>
            </span>
            {showScope ? <ScopeChip doc={doc}/> : !doc.can_edit && <span className={cx('sub')}><Icon name='lock'/></span>}
        </button>
    );
}

type SectionProps = {
    showScope?: boolean;
    title: React.ReactNode;
    docs: Doc[] | null;
    empty: React.ReactNode;
    canCreate: boolean;
    onCreate: () => void;
    createLabel: string;
};

function Section({title, docs, empty, canCreate, onCreate, createLabel, showScope = false}: SectionProps) {
    return (
        <>
            <div className={cx('app-h')}>
                <span className={cx('grow')}>{title}</span>
                {canCreate && (
                    <button
                        className={cx('icon-btn', 'notes-h-btn')}
                        title={createLabel}
                        aria-label={createLabel}
                        onClick={onCreate}
                    >
                        <Icon
                            name='plus'
                            size='sm'
                        />
                    </button>
                )}
            </div>
            {docs?.length ? docs.map((doc) => (
                <NoteRow
                    key={doc.id}
                    doc={doc}
                    showScope={showScope}
                />
            )) : <div className={cx('notes-empty')}>{docs ? empty : '…'}</div>}
        </>
    );
}

const byUpdate = (a: Doc, b: Doc) => b.update_at - a.update_at;

// NoteList lists the notes of the current channel and the user's personal notes.
export default function NoteList({channel}: {channel?: Channel}) {
    const intl = useIntl();
    const me = useSelector(getCurrentUserId);
    const channelId = channel?.id;
    const [channelDocs, setChannelDocs] = useState<Doc[] | null>(null);
    const [personalDocs, setPersonalDocs] = useState<Doc[] | null>(null);
    const [favoriteDocs, setFavoriteDocs] = useState<Doc[] | null>(null);
    const [error, setError] = useState('');
    const view = useListView();

    const loadChannel = useCallback(() => {
        if (!channelId) {
            setChannelDocs([]);
            return;
        }
        client.listDocs(channelId).then((docs) => setChannelDocs(docs.sort(byUpdate)), () => setChannelDocs([]));
    }, [channelId]);
    const loadPersonal = useCallback(() => {
        client.listDocs().then((docs) => setPersonalDocs(docs.sort(byUpdate)), () => setPersonalDocs([]));
    }, []);

    useEffect(() => {
        setChannelDocs(null);
        loadChannel();
    }, [loadChannel]);
    useEffect(loadPersonal, [loadPersonal]);

    const favoriteIds = useMemo(() => new Set((favoriteDocs || []).map((f) => f.id)), [favoriteDocs]);

    // The favorites, from any channel, load when shown
    const loadFavorites = useCallback(() => {
        client.listFavorites().then(setFavoriteDocs, () => setFavoriteDocs([]));
    }, []);
    useEffect(() => {
        if (view === 'favorites') {
            loadFavorites();
        }
    }, [view, loadFavorites]);

    useEffect(() => events.addListListener(({doc}) => {
        if (doc.channel_id && doc.channel_id === channelId) {
            loadChannel();
        } else if (!doc.channel_id && doc.owner_id === me) {
            loadPersonal();
        }
        if (view === 'favorites' && favoriteIds.has(doc.id)) {
            loadFavorites();
        }
    }), [channelId, me, loadChannel, loadPersonal, view, favoriteIds, loadFavorites]);

    const create = async (personal: boolean) => {
        setError('');
        try {
            const doc = await client.createDoc('', personal ? '' : channelId);
            setOpenDoc(doc.id);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const archived = Boolean(channel?.delete_at);
    const channelName = channel?.type === 'D' || channel?.type === 'G' ? intl.formatMessage({id: 'notes.list.conversation', defaultMessage: 'this conversation'}) : channel?.display_name;

    const shown = channel || view === 'favorites' ? view : 'mine';
    const conversation = channel?.type === 'D' || channel?.type === 'G';

    return (
        <div className={cx('app-panel', 'notes-list')}>
            {channel && (
                <div
                    className={cx('seg', 'notes-seg')}
                    role='tablist'
                >
                    <button
                        type='button'
                        role='tab'
                        aria-selected={shown === 'channel'}
                        className={shown === 'channel' ? cx('on') : ''}
                        onClick={() => setListView('channel')}
                    >
                        {conversation ? (
                            <FormattedMessage
                                id='notes.list.view_conversation'
                                defaultMessage='This conversation'
                            />
                        ) : (
                            <FormattedMessage
                                id='notes.list.view_channel'
                                defaultMessage='This channel'
                            />
                        )}
                    </button>
                    <button
                        type='button'
                        role='tab'
                        aria-selected={shown === 'favorites'}
                        className={shown === 'favorites' ? cx('on') : ''}
                        onClick={() => setListView('favorites')}
                    >
                        <FormattedMessage
                            id='notes.list.view_favorites'
                            defaultMessage='Favorites'
                        />
                    </button>
                    <button
                        type='button'
                        role='tab'
                        aria-selected={shown === 'mine'}
                        className={shown === 'mine' ? cx('on') : ''}
                        onClick={() => setListView('mine')}
                    >
                        <FormattedMessage
                            id='notes.list.view_mine'
                            defaultMessage='Mine'
                        />
                    </button>
                </div>
            )}
            {error && <div className={cx('notes-error')}>{error}</div>}
            {shown === 'favorites' && (
                <Section
                    title={
                        <FormattedMessage
                            id='notes.list.favorites'
                            defaultMessage='Favorites'
                        />
                    }
                    docs={favoriteDocs}
                    empty={
                        <FormattedMessage
                            id='notes.list.favorites_empty'
                            defaultMessage='Star a note to find it here, wherever it is.'
                        />
                    }
                    canCreate={false}
                    onCreate={() => null}
                    createLabel=''
                    showScope={true}
                />
            )}
            {shown === 'channel' && channel && (
                <Section
                    title={
                        <FormattedMessage
                            id='notes.list.channel'
                            defaultMessage='Shared with {channel}'
                            values={{channel: channelName}}
                        />
                    }
                    docs={channelDocs}
                    empty={
                        <FormattedMessage
                            id='notes.list.channel_empty'
                            defaultMessage='No notes here yet. Notes added here can be edited by every member of the channel.'
                        />
                    }
                    canCreate={!archived}
                    onCreate={() => create(false)}
                    createLabel={intl.formatMessage({id: 'notes.list.new_channel', defaultMessage: 'New note in this channel'})}
                />
            )}
            {shown === 'mine' && (
                <Section
                    title={
                        <FormattedMessage
                            id='notes.list.personal'
                            defaultMessage='Personal notes'
                        />
                    }
                    docs={personalDocs}
                    empty={
                        <FormattedMessage
                            id='notes.list.personal_empty'
                            defaultMessage='Only you can see your personal notes.'
                        />
                    }
                    canCreate={true}
                    onCreate={() => create(true)}
                    createLabel={intl.formatMessage({id: 'notes.list.new_personal', defaultMessage: 'New personal note'})}
                />
            )}
        </div>
    );
}
