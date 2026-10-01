// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {useSyncExternalStore} from 'react';

// The note open in the panel, shared by the panel and the cards of shared notes.
let openDocId: string | null = null;
let showPanel: () => void = () => null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function setOpenDoc(docId: string | null) {
    if (openDocId !== docId) {
        openDocId = docId;
        listeners.forEach((l) => l());
    }
}

export function useOpenDoc() {
    return useSyncExternalStore(subscribe, () => openDocId);
}

// setShowPanel sets how to show the notes panel (the right-hand sidebar of the plugin).
export function setShowPanel(show: () => void) {
    showPanel = show;
}

// openNote shows a note in the notes panel.
export function openNote(docId: string) {
    setOpenDoc(docId);
    showPanel();
}
