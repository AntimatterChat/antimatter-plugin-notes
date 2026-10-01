// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {client, events} from '../client';
import type {Doc} from '../relay/client';
import Icon from '../ui/icon';
import {cx} from '../ui/web_ui';
import {setOpenDoc} from '../ui_state';

import {useDisplayName} from './hooks';
import RelativeTime from './relative_time';

function NoteRow({doc}: {doc: Doc}) {
    const editor = useDisplayName(doc.updated_by || doc.creator_id);
    return (
        <button
            className={cx('app-row')}
            onClick={() => setOpenDoc(doc.id)}
        >
            <span className={cx('notes-row-ic')}><Icon name='pad'/></span>
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
            {!doc.can_edit && <span className={cx('sub')}><Icon name='lock'/></span>}
        </button>
    );
}

type SectionProps = {
    title: React.ReactNode;
    docs: Doc[] | null;
    empty: React.ReactNode;
    canCreate: boolean;
    onCreate: () => void;
    createLabel: string;
};

function Section({title, docs, empty, canCreate, onCreate, createLabel}: SectionProps) {
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
    const [error, setError] = useState('');

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

    useEffect(() => events.addListListener(({doc}) => {
        if (doc.channel_id && doc.channel_id === channelId) {
            loadChannel();
        } else if (!doc.channel_id && doc.owner_id === me) {
            loadPersonal();
        }
    }), [channelId, me, loadChannel, loadPersonal]);

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

    return (
        <div className={cx('app-panel', 'notes-list')}>
            {error && <div className={cx('notes-error')}>{error}</div>}
            {channel && (
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
        </div>
    );
}
