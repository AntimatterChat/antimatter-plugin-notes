// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import * as Y from 'yjs';

import NoteSession from './note_session';
import FakeRelay from './relay/fake_relay';

async function settle() {
    for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(200);
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
}

const text = (session: NoteSession) => session.ydoc.getText('t').toString();
const names = (session: NoteSession) => session.editors().map((e) => e.name).sort();
const selfName = (session: NoteSession) => session.editors().find((e) => e.self)?.name;
const seqs = (relay: FakeRelay) => relay.updates.map((u) => u.seq);

async function openSession(relay: FakeRelay, name: string) {
    const session = new NoteSession(relay, 'doc');
    relay.connect(session.connection);
    await session.start({userId: name, name, color: '#000'});
    return session;
}

describe('NoteSession', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    test('two editors converge through the relay', async () => {
        const relay = new FakeRelay();
        const alice = await openSession(relay, 'alice');
        const bob = await openSession(relay, 'bob');

        alice.ydoc.getText('t').insert(0, 'Hello');
        await settle();
        expect(text(bob)).toBe('Hello');

        // Concurrent edits
        alice.ydoc.getText('t').insert(5, ' world');
        bob.ydoc.getText('t').insert(0, '> ');
        await settle();
        expect(text(alice)).toBe('> Hello world');
        expect(text(bob)).toBe('> Hello world');

        // A late joiner loads the log
        const carol = await openSession(relay, 'carol');
        expect(text(carol)).toBe('> Hello world');
    });

    test('compacted notes load from the snapshot', async () => {
        const relay = new FakeRelay();
        relay.compactAfter = 3;
        const alice = await openSession(relay, 'alice');
        for (const word of ['a', 'b', 'c', 'd']) {
            alice.ydoc.getText('t').insert(text(alice).length, word);
            // eslint-disable-next-line no-await-in-loop
            await settle();
        }
        expect(relay.snapshotSeq).toBe(3);
        expect(seqs(relay)).toEqual([4]);

        const bob = await openSession(relay, 'bob');
        expect(text(bob)).toBe('abcd');
        const snapshotDoc = new Y.Doc();
        Y.applyUpdate(snapshotDoc, relay.snapshot as Uint8Array);
        expect(snapshotDoc.getText('t').toString()).toBe('abc');
    });

    test('shows who is editing', async () => {
        const relay = new FakeRelay();
        const alice = await openSession(relay, 'alice');
        const bob = await openSession(relay, 'bob');
        await settle();

        expect(names(alice)).toEqual(['alice', 'bob']);
        expect(selfName(bob)).toBe('bob');

        alice.destroy();
        await settle();
        expect(names(bob)).toEqual(['bob']);
    });
});
