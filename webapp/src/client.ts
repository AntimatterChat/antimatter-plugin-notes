// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

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
