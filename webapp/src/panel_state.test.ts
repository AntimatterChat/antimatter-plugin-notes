// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {panelStateOf, parsePanelState} from './panel_state';

describe('the panel state', () => {
    test('names the open note, its versions, or the list shown', () => {
        expect(panelStateOf({docId: 'n1', history: false, listView: 'channel'})).toBe('note/n1');
        expect(panelStateOf({docId: 'n1', history: true, listView: 'mine'})).toBe('note/n1/history');
        expect(panelStateOf({docId: null, history: false, listView: 'mine'})).toBe('list/mine');
        expect(panelStateOf({docId: null, history: false, listView: 'favorites'})).toBe('list/favorites');

        // The channel's list is the app's home: no state
        expect(panelStateOf({docId: null, history: true, listView: 'channel'})).toBe('');
    });

    test('reads back what it wrote', () => {
        for (const place of [
            {docId: 'abcdefghijklmnopqrstuvwxyz', history: false, listView: 'channel' as const},
            {docId: 'n1', history: true, listView: 'channel' as const},
            {docId: null, history: false, listView: 'mine' as const},
            {docId: null, history: false, listView: 'favorites' as const},
        ]) {
            expect(parsePanelState(panelStateOf(place))).toEqual(place);
        }
    });

    test("is the channel's list for no state, or one it didn't write", () => {
        expect(parsePanelState(undefined)).toBeNull();
        expect(parsePanelState('')).toBeNull();
        for (const state of ['note', 'note/', 'note/../admin', 'note/n1/edit', 'note/n1/history/x', 'note/a b', 'list/all', 'list', 'board/b1', `note/${'a'.repeat(65)}`]) {
            expect(parsePanelState(state)).toBeNull();
        }
    });
});
