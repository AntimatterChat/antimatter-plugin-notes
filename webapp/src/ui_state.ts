// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {useSyncExternalStore} from 'react';

// The note open in the panel, shared by the panel and the cards of shared notes.
let openDocId: string | null = null;
let showPanel: () => void = () => null;
const listeners = new Set<() => void>();

// The channel the panel was closed in: opened again in another channel, it shows its list, not what was left open.
let closedIn: string | null = null;

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function setOpenDoc(docId: string | null) {
    // Opening a document (from its card in a channel) is what the panel shows next, wherever it was closed
    if (docId) {
        closedIn = null;
    }
    if (openDocId !== docId) {
        openDocId = docId;
        listeners.forEach((l) => l());
    }
}

export function useOpenDoc() {
    return useSyncExternalStore(subscribe, () => openDocId);
}

// The list shows the channel's notes or the user's own ones, as the todo app does.
export type ListView = 'channel' | 'favorites' | 'mine';
let listView: ListView = 'channel';

export function setListView(view: ListView) {
    if (listView !== view) {
        listView = view;
        listeners.forEach((l) => l());
    }
}

export function useListView() {
    return useSyncExternalStore(subscribe, () => listView);
}

export function panelClosed(channelId: string) {
    closedIn = channelId;
}

export function panelOpened(channelId: string) {
    if (closedIn !== null && closedIn !== channelId) {
        openDocId = null;
    }
    closedIn = null;
}

// restorePanel puts the panel where it was in the window it was popped out of (see panel_state.ts), as it first
// renders: quietly, as the panel reads it right after; panelRestored then tells the others (the header).
export function restorePanel(docId: string | null, view: ListView) {
    openDocId = docId;
    listView = view;
    closedIn = null;
}

export function panelRestored() {
    listeners.forEach((l) => l());
}

// setShowPanel sets how to show the notes panel (the right-hand sidebar of the plugin).
export function setShowPanel(show: () => void) {
    showPanel = show;
}

// The notes app draws its header in the panel's header (the title it gives the host is NotesHeader): the row of
// the panel's header where the list and the open note put their title and actions, while it's shown.
let headSlot: HTMLElement | null = null;

export function setHeadSlot(element: HTMLElement) {
    if (headSlot !== element) {
        headSlot = element;
        listeners.forEach((l) => l());
    }
}

// clearHeadSlot forgets the header's row as it goes away, unless another one took its place.
export function clearHeadSlot(element: HTMLElement) {
    if (headSlot === element) {
        headSlot = null;
        listeners.forEach((l) => l());
    }
}

export function useHeadSlot() {
    return useSyncExternalStore(subscribe, () => headSlot);
}

// openNote shows a note in the notes panel.
export function openNote(docId: string) {
    setOpenDoc(docId);
    showPanel();
}
