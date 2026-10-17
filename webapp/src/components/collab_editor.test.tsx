// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {cleanup, render, screen, within} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {legacy_createStore as createStore} from 'redux';

import NoteSession, {type Editor} from '../note_session';
import FakeRelay from '../relay/fake_relay';

import CollabEditor from './collab_editor';
import EditorsBar from './editors_bar';

jest.mock('mattermost-redux/client', () => ({Client4: {getProfilesByIds: jest.fn(() => Promise.resolve([])), autocompleteUsers: jest.fn()}}));

const store = createStore(() => ({
    entities: {
        general: {config: {}, license: {}},
        preferences: {myPreferences: {}},
        users: {currentUserId: 'me', profiles: {}, statuses: {}, profilesInChannel: {}},
        channels: {currentChannelId: '', channels: {}, myMembers: {}},
        teams: {currentTeamId: 't1', teams: {t1: {id: 't1', name: 'lumen'}}},
    },
}));

function withHost(ui: React.ReactNode) {
    return render(
        <Provider store={store}>
            <IntlProvider locale='en'>{ui}</IntlProvider>
        </Provider>,
    );
}

describe("the note's toolbar row", () => {
    let session: NoteSession;
    beforeEach(() => {
        session = new NoteSession(new FakeRelay(), 'doc');
    });
    afterEach(() => {
        // The editor goes before its session
        cleanup();
        session.destroy();
    });

    const renderEditor = (editable: boolean) => withHost(
        <CollabEditor
            session={session}
            user={{userId: 'me', name: 'maya', color: '#f00'}}
            editable={editable}
            channelId='c1'
            onEditor={() => null}
            meta={<span data-testid='meta'>{'Saved'}</span>}
        />,
    );

    test('has the formatting tools, then who is editing and the status, in one row', () => {
        renderEditor(true);
        const toolbar = screen.getByRole('toolbar', {name: 'Formatting'});
        expect(within(toolbar).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(
            ['Bold', 'Italic', 'Strikethrough', 'Heading', 'Bulleted list', 'Numbered list', 'Checklist item', 'Undo'],
        );
        expect(toolbar.parentElement).toContainElement(screen.getByTestId('meta'));
        expect(screen.getByRole('textbox', {name: 'Shared notes'})).toBeInTheDocument();
    });

    test("has no formatting tools for those who can't edit, only the meta", () => {
        renderEditor(false);
        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Bold'})).not.toBeInTheDocument();
        expect(screen.getByTestId('meta')).toBeInTheDocument();
    });
});

describe('who is editing', () => {
    const editor = (userId: string, clientId: number, self = false): Editor => ({userId, name: userId, color: '#0a0', clientId, self});

    test('shows only the status when you are alone', () => {
        withHost(
            <EditorsBar
                editors={[editor('maya', 1, true)]}
                status='saved'
                readOnly={false}
            />,
        );
        expect(screen.queryByRole('group')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Saved');
    });

    test('shows a dot per person, you first, and counts those beyond four', () => {
        withHost(
            <EditorsBar
                editors={[editor('ada', 2), editor('maya', 1, true), editor('ada', 3), editor('leo', 4), editor('kenji', 5), editor('sam', 6), editor('zoe', 7)]}
                status='saved'
                readOnly={false}
            />,
        );
        const group = screen.getByRole('group', {name: '6 editing'});
        expect(within(group).getAllByRole('img').map((dot) => dot.getAttribute('aria-label'))).toEqual(['You', 'ada', 'leo', 'kenji']);
        expect(group).toHaveTextContent('+2');
    });

    test("says the note is read only to those who can't edit it", () => {
        withHost(
            <EditorsBar
                editors={[]}
                status='saved'
                readOnly={true}
            />,
        );
        expect(screen.getByRole('status')).toHaveTextContent('Read only');
    });
});
