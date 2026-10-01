// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';

import manifest from './manifest';
import {RelayClient} from './relay/client';
import {RelayEventBus} from './relay/events';

// The notes API of the server, and the websocket events of the notes.
export const client = new RelayClient(manifest.id);
export const events = new RelayEventBus();

// shareNote posts a card linking to a note in its channel.
export function shareNote(docId: string) {
    return client.request<Post>('POST', `/docs/${docId}/share`, {});
}

// MentionUser is a user who can be mentioned in a note.
export type MentionUser = {
    id: string;
    username: string;
    name: string;
};

const MENTION_LIMIT = 8;

// searchUsers returns the users whose name starts with a text, for mentions: those of the note's
// channel first, or of the whole server for personal notes.
export async function searchUsers(query: string, teamId: string, channelId: string): Promise<MentionUser[]> {
    const result = await Client4.autocompleteUsers(query, channelId ? teamId : '', channelId, {limit: MENTION_LIMIT});
    const users = [...(result.users || []), ...(result.out_of_channel || [])];
    return users.
        filter((u) => !u.delete_at).
        slice(0, MENTION_LIMIT).
        map((u) => ({
            id: u.id,
            username: u.username,
            name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.nickname || '',
        }));
}
