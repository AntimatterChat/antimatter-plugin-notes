// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates} from 'y-protocols/awareness';
import * as Y from 'yjs';

import RelayConnection, {type RelayAPI, type SyncStatus} from './relay/connection';

// The origin of the changes received from the relay, which aren't sent back.
const REMOTE = 'relay';

// The awareness of the editor is sent at most this often.
const AWARENESS_INTERVAL = 100;

export type NoteUser = {
    userId: string;
    name: string;
    color: string;
};

export type Editor = NoteUser & {clientId: number; self: boolean};

type AwarenessChange = {added: number[]; updated: number[]; removed: number[]};

// NoteSession is an open note: its Yjs document, the presence of its editors (Yjs awareness,
// used by the editor for the remote carets), kept in sync with the relay.
export default class NoteSession {
    readonly ydoc = new Y.Doc();
    readonly awareness = new Awareness(this.ydoc);
    readonly connection: RelayConnection;

    status: SyncStatus = 'loading';
    readOnly = false;

    // version changes whenever the status or the editors change.
    version = 0;
    private listeners = new Set<() => void>();
    private awarenessTimer: ReturnType<typeof setTimeout> | null = null;
    private lastAwarenessSent = 0;
    private destroyed = false;

    constructor(api: RelayAPI, docId: string) {
        this.connection = new RelayConnection(api, docId, String(this.ydoc.clientID), {
            applyRemote: (data) => Y.applyUpdate(this.ydoc, data, REMOTE),
            merge: (updates) => Y.mergeUpdates(updates),
            snapshot: () => Y.encodeStateAsUpdate(this.ydoc),
            applyAwareness: (_, data) => applyAwarenessUpdate(this.awareness, data, REMOTE),
            onStatus: (status) => {
                this.status = status;
                this.emit();
            },
            onReadOnly: () => {
                this.readOnly = true;
                this.emit();
            },
        });
        this.ydoc.on('update', this.handleDocUpdate);
        this.awareness.on('update', this.handleAwarenessUpdate);
        this.awareness.on('change', this.emit);
    }

    get docId() {
        return this.connection.docId;
    }

    async start(user: NoteUser) {
        this.awareness.setLocalStateField('user', user);
        await this.connection.start();
    }

    // subscribe calls the listener when the status or the editors change.
    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private emit = () => {
        this.version++;
        for (const listener of this.listeners) {
            listener();
        }
    };

    // editors returns the people who have the note open.
    editors(): Editor[] {
        const editors: Editor[] = [];
        this.awareness.getStates().forEach((state, clientId) => {
            const user = state.user as NoteUser | undefined;
            if (user?.userId) {
                editors.push({...user, clientId, self: clientId === this.ydoc.clientID});
            }
        });
        return editors;
    }

    private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
        if (origin !== REMOTE) {
            this.connection.send(update);
        }
    };

    private handleAwarenessUpdate = ({added}: AwarenessChange, origin: unknown) => {
        if (origin === REMOTE) {
            // Show ourselves to the editors who just opened the note
            if (added.length) {
                this.scheduleAwareness(AWARENESS_INTERVAL * 3);
            }
            return;
        }
        if (origin === 'local') {
            this.scheduleAwareness(Math.max(0, AWARENESS_INTERVAL - (Date.now() - this.lastAwarenessSent)));
        }
    };

    private scheduleAwareness(delay: number) {
        if (this.awarenessTimer || this.destroyed) {
            return;
        }
        this.awarenessTimer = setTimeout(() => {
            this.awarenessTimer = null;
            this.sendAwareness();
        }, delay);
    }

    private sendAwareness(keepalive = false) {
        this.lastAwarenessSent = Date.now();
        this.connection.sendAwareness(encodeAwarenessUpdate(this.awareness, [this.ydoc.clientID]), keepalive);
    }

    // destroy leaves the note: the others stop seeing this editor, and the pending changes are sent.
    destroy() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        if (this.awarenessTimer) {
            clearTimeout(this.awarenessTimer);
            this.awarenessTimer = null;
        }
        this.awareness.off('update', this.handleAwarenessUpdate);
        removeAwarenessStates(this.awareness, [this.ydoc.clientID], 'local');
        this.sendAwareness(true);

        this.ydoc.off('update', this.handleDocUpdate);
        const connection = this.connection;
        connection.flush().finally(() => connection.stop());
        this.awareness.destroy();
        this.listeners.clear();
    }
}
