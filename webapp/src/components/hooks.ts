// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {useEffect, useMemo, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {UserTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {searchUsers} from '../client';

import type {MentionOptions} from './mention';

// The users to load, batched in one request. (The mattermost-redux actions would bring most of
// mattermost-redux, and moment, in the bundle.)
const requested = new Set<string>();
let batch: string[] = [];

function loadUser(dispatch: Dispatch, userId: string) {
    if (requested.has(userId)) {
        return;
    }
    requested.add(userId);
    batch.push(userId);
    if (batch.length > 1) {
        return;
    }
    setTimeout(async () => {
        const ids = batch;
        batch = [];
        try {
            const profiles = await Client4.getProfilesByIds(ids);
            dispatch({type: UserTypes.RECEIVED_PROFILES_LIST, data: profiles});
        } catch {
            ids.forEach((id) => requested.delete(id));
        }
    }, 0);
}

// useDisplayName returns the name of a user as the viewer chose to see names, loading the user
// if needed.
export function useDisplayName(userId?: string): string {
    const dispatch = useDispatch();
    const user = useSelector((state: GlobalState) => (userId ? getUser(state, userId) : null)) as UserProfile | null;
    const setting = useSelector(getTeammateNameDisplaySetting);

    useEffect(() => {
        if (userId && !user) {
            loadUser(dispatch, userId);
        }
    }, [dispatch, userId, user]);

    return user ? displayUsername(user, setting) : '';
}

// useMentions returns the mention features of a note's editor: users of the note's channel (or
// of the server for personal notes) suggested after @, and mentions opening the direct messages
// with the user, in the current team.
export function useMentions(channelId: string, noResults: string): MentionOptions {
    const teamId = useSelector(getCurrentTeamId);
    const team = useSelector(getCurrentTeam);
    const context = useRef({teamId, teamName: team?.name || '', channelId});
    context.current = {teamId, teamName: team?.name || '', channelId};

    return useMemo(() => ({
        search: (query: string) => searchUsers(query, context.current.teamId, context.current.channelId),
        noResults,
        onClick: (username: string) => {
            if (!context.current.teamName || !username) {
                return;
            }
            const path = `/${context.current.teamName}/messages/@${username}`;
            const history = window.WebappUtils?.browserHistory;
            if (history) {
                history.push(path);
            } else {
                window.location.assign(`${window.basename || ''}${path}`);
            }
        },
    }), [noResults]);
}
