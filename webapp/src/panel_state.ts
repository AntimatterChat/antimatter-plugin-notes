// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import type {ListView} from './ui_state';

// Where the notes panel is, as it tells the host (its setPanelState prop) so that "Open in new window" starts
// there: 'note/<id>', 'note/<id>/history' (its versions), 'list/favorites' or 'list/mine'; nothing on the channel's
// list. It only names what is shown: the new window fetches the note again as the person signed in there.
export type PanelPlace = {
    docId: string | null;
    history: boolean;
    listView: ListView;
};

const DOC_ID = /^[A-Za-z0-9_-]{1,64}$/;
const LIST_VIEWS: ListView[] = ['channel', 'favorites', 'mine'];

// panelStateOf returns the state of a place, '' for the channel's list.
export function panelStateOf(place: PanelPlace): string {
    if (place.docId) {
        return `note/${place.docId}${place.history ? '/history' : ''}`;
    }
    return place.listView === 'channel' ? '' : `list/${place.listView}`;
}

// parsePanelState returns the place a state names, or null for the channel's list: no state, or one this app
// didn't write (another version's, or a hand-edited address).
export function parsePanelState(state: string | null | undefined): PanelPlace | null {
    if (!state) {
        return null;
    }
    const parts = state.split('/');
    if (parts[0] === 'note' && DOC_ID.test(parts[1] || '') && (parts.length === 2 || (parts.length === 3 && parts[2] === 'history'))) {
        return {docId: parts[1], history: parts.length === 3, listView: 'channel'};
    }
    if (parts[0] === 'list' && parts.length === 2 && LIST_VIEWS.includes(parts[1] as ListView)) {
        return {docId: null, history: false, listView: parts[1] as ListView};
    }
    return null;
}
