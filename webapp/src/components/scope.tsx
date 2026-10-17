// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import type {GlobalState} from '@mattermost/types/store';

import {client} from '../client';
import type {Doc} from '../relay/client';
import Icon from '../ui/icon';
import {cx} from '../ui/web_ui';

// ScopeChip tells at a glance whose a note is: shared with a channel (its name, in the app's colour), or
// personal (a lock, outlined). Compact, in the note's header, it's only the icon, with the same tooltip.
export default function ScopeChip({doc, compact = false}: {doc: Doc; compact?: boolean}) {
    const intl = useIntl();
    const channel = useSelector((state: GlobalState) => (doc.channel_id ? getChannel(state, doc.channel_id) : null));
    if (!doc.channel_id) {
        const tip = intl.formatMessage({id: 'notes.scope.personal_tip', defaultMessage: 'Personal: only you can see it'});
        return (
            <span
                className={cx('notes-scope', 'notes-scope-personal', compact && 'notes-scope-compact')}
                title={tip}
                role={compact ? 'img' : undefined}
                aria-label={compact ? tip : undefined}
            >
                <Icon
                    name='lock'
                    size='xs'
                />
                {!compact && intl.formatMessage({id: 'notes.scope.personal', defaultMessage: 'Personal'})}
            </span>
        );
    }
    const conversation = channel?.type === 'D' || channel?.type === 'G';
    const name = conversation ? intl.formatMessage({id: 'notes.scope.conversation', defaultMessage: 'Conversation'}) : channel?.display_name || '';
    const tip = conversation ? intl.formatMessage({id: 'notes.scope.conversation_tip', defaultMessage: 'Shared with everyone in this conversation'}) : intl.formatMessage({id: 'notes.scope.shared_tip', defaultMessage: 'Shared with everyone in ~{channel}'}, {channel: name});
    return (
        <span
            className={cx('notes-scope', 'notes-scope-shared', compact && 'notes-scope-compact')}
            title={tip}
            role={compact ? 'img' : undefined}
            aria-label={compact ? tip : undefined}
        >
            <Icon
                name={conversation ? 'users' : 'hash'}
                size='xs'
            />
            {!compact && name}
        </span>
    );
}

// FavoriteButton stars a note, to find it among the favorites from any channel.
export function FavoriteButton({doc}: {doc: Doc}) {
    const intl = useIntl();
    const [favorite, setFavorite] = useState(Boolean(doc.favorite));
    useEffect(() => setFavorite(Boolean(doc.favorite)), [doc.id, doc.favorite]);
    const label = favorite ? intl.formatMessage({id: 'notes.favorite.remove', defaultMessage: 'Remove from favorites'}) : intl.formatMessage({id: 'notes.favorite.add', defaultMessage: 'Add to favorites'});
    return (
        <button
            type='button'
            className={cx('icon-btn', 'notes-star', favorite && 'on')}
            title={label}
            aria-label={label}
            aria-pressed={favorite}
            onClick={() => {
                setFavorite(!favorite);
                client.setFavorite(doc.id, !favorite).catch(() => setFavorite(favorite));
            }}
        >
            <Icon name='star'/>
        </button>
    );
}
