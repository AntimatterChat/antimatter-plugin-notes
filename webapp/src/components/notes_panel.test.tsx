// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {fireEvent, render, screen, within} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {legacy_createStore as createStore} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {client} from '../client';
import type {Doc} from '../relay/client';
import {setListView, setOpenDoc} from '../ui_state';

import NotesHeader from './notes_header';
import NotesPanel from './notes_panel';

// Where the panel is (the host's setPanelState and initialPanelState props), in the window it's in and in the one it
// was popped out into. The rest of the panel is tested in notes_header.test.tsx.

jest.mock('mattermost-redux/client', () => ({Client4: {getProfilesByIds: jest.fn(() => Promise.resolve([])), autocompleteUsers: jest.fn()}}));

jest.mock('../client', () => ({
    client: {
        listDocs: jest.fn(),
        listFavorites: jest.fn(),
        createDoc: jest.fn(),
        getDoc: jest.fn(),
        renameDoc: jest.fn(),
        deleteDoc: jest.fn(),
        setFavorite: jest.fn(),
        moveDoc: jest.fn(),
        getVersions: jest.fn(),
    },
    events: {addDoc: () => () => null, addListListener: () => () => null},
    shareNote: jest.fn(),
    searchUsers: jest.fn(),
}));

jest.mock('../note_session', () => ({
    __esModule: true,
    default: class {
        status = 'saved';
        readOnly = false;
        version = 0;
        connection = {pending: () => false};
        start() {
            return Promise.resolve();
        }
        subscribe() {
            return () => null;
        }
        editors() {
            return [];
        }
        destroy() {
            return null;
        }
    },
}));

jest.mock('./collab_editor', () => {
    const {createElement} = jest.requireActual('react');
    return {
        __esModule: true,
        default: () => createElement('div', {'data-testid': 'editor'}),
    };
});

const mocked = client as jest.Mocked<typeof client>;

const townSquare = {id: 'c1', type: 'O', display_name: 'Town Square', name: 'town-square', delete_at: 0} as Channel;

const note: Doc = {
    id: 'n1',
    title: 'Plan',
    channel_id: 'c1',
    creator_id: 'me',
    create_at: 1,
    update_at: Date.now(),
    can_edit: true,
    can_delete: true,
};

function store() {
    const state = {
        entities: {
            general: {config: {}, license: {}},
            preferences: {myPreferences: {}},
            users: {currentUserId: 'me', profiles: {me: {id: 'me', username: 'maya'}}, statuses: {}, profilesInChannel: {}},
            channels: {currentChannelId: 'c1', channels: {c1: townSquare}, myMembers: {}},
            teams: {currentTeamId: 't1', teams: {t1: {id: 't1', name: 'lumen'}}},
        },
    };
    return createStore(() => state);
}

// renderApp renders the app as Fusion does: its title in the panel's header, the panel under it, with the props the
// host gives it.
function renderApp(props: {initialPanelState?: string} = {}) {
    const setPanelState = jest.fn();
    render(
        <Provider store={store()}>
            <IntlProvider locale='en'>
                <div data-testid='panel-header'>
                    <NotesHeader/>
                </div>
                <div data-testid='panel'>
                    <NotesPanel
                        {...props}
                        setPanelState={setPanelState}
                    />
                </div>
            </IntlProvider>
        </Provider>,
    );
    return setPanelState;
}

const header = () => within(screen.getByTestId('panel-header'));
const panel = () => within(screen.getByTestId('panel'));

beforeEach(() => {
    jest.clearAllMocks();
    setOpenDoc(null);
    setListView('channel');
    mocked.listDocs.mockResolvedValue([]);
    mocked.listFavorites.mockResolvedValue([]);
    mocked.getDoc.mockResolvedValue(note);
    mocked.getVersions.mockResolvedValue([]);
});

describe('in the window it was popped out into', () => {
    test('the panel starts at the note it showed, fetched again', async () => {
        const setPanelState = renderApp({initialPanelState: 'note/n1'});

        expect(await header().findByRole('textbox', {name: 'Title'})).toHaveValue('Plan');
        expect(mocked.getDoc).toHaveBeenCalledWith('n1');
        expect(panel().getByTestId('editor')).toBeInTheDocument();

        // It says it's there from the start, never on its list first
        expect(setPanelState).toHaveBeenCalledWith('note/n1');
        expect(setPanelState).not.toHaveBeenCalledWith(null);
        expect(mocked.listDocs).not.toHaveBeenCalled();
    });

    test("the panel starts at the note's versions", async () => {
        const setPanelState = renderApp({initialPanelState: 'note/n1/history'});

        expect(await header().findByText('Versions of Plan')).toBeInTheDocument();
        expect(await panel().findByText(/No past versions yet/)).toBeInTheDocument();
        expect(mocked.getVersions).toHaveBeenCalledWith('n1');
        expect(setPanelState).toHaveBeenLastCalledWith('note/n1/history');

        // Back to the note, then to the list: the state follows
        fireEvent.click(header().getByRole('button', {name: 'All notes'}));
        expect(header().getByRole('textbox', {name: 'Title'})).toBeInTheDocument();
        expect(setPanelState).toHaveBeenLastCalledWith('note/n1');

        fireEvent.click(header().getByRole('button', {name: 'All notes'}));
        expect(await header().findByText('Notes')).toBeInTheDocument();
        expect(setPanelState).toHaveBeenLastCalledWith(null);
    });

    test('the panel starts on the list it showed', async () => {
        const setPanelState = renderApp({initialPanelState: 'list/mine'});

        expect(await panel().findByRole('tab', {name: 'Mine'})).toHaveAttribute('aria-selected', 'true');
        expect(setPanelState).toHaveBeenLastCalledWith('list/mine');
    });

    test("a note the person can't open any more shows its not-found view, and the way back to the list", async () => {
        mocked.getDoc.mockRejectedValue(Object.assign(new Error('Forbidden'), {status: 404}));
        const setPanelState = renderApp({initialPanelState: 'note/n1'});

        expect(await panel().findByText("This note was deleted, or you can't open it.")).toBeInTheDocument();
        expect(panel().queryByTestId('editor')).not.toBeInTheDocument();

        fireEvent.click(header().getByRole('button', {name: 'All notes'}));
        expect(await header().findByText('Notes')).toBeInTheDocument();
        expect(setPanelState).toHaveBeenLastCalledWith(null);
    });

    test("a state the app didn't write opens its list, and fetches nothing it names", async () => {
        const setPanelState = renderApp({initialPanelState: 'note/../admin'});

        expect(await panel().findByRole('tab', {name: 'This channel'})).toHaveAttribute('aria-selected', 'true');
        expect(mocked.getDoc).not.toHaveBeenCalled();
        expect(setPanelState).toHaveBeenLastCalledWith(null);
    });
});

describe('in the main window', () => {
    test('the panel says where it is as it moves', async () => {
        const setPanelState = renderApp();
        expect(setPanelState).toHaveBeenLastCalledWith(null);

        // Its own notes
        fireEvent.click(await panel().findByRole('tab', {name: 'Mine'}));
        expect(setPanelState).toHaveBeenLastCalledWith('list/mine');

        // A note, and its versions
        mocked.createDoc.mockResolvedValue({...note, id: 'n2', channel_id: ''});
        mocked.getDoc.mockResolvedValue({...note, id: 'n2', channel_id: ''});
        fireEvent.click(await header().findByRole('button', {name: 'New personal note'}));
        expect(await header().findByRole('textbox', {name: 'Title'})).toBeInTheDocument();
        expect(setPanelState).toHaveBeenLastCalledWith('note/n2');

        fireEvent.click(header().getByRole('button', {name: 'Note actions'}));
        fireEvent.click(screen.getByRole('menuitem', {name: 'Version history'}));
        expect(setPanelState).toHaveBeenLastCalledWith('note/n2/history');
        expect(await panel().findByText(/No past versions yet/)).toBeInTheDocument();
    });

    test('without the host props (the classic UI), it opens on its list as before', async () => {
        render(
            <Provider store={store()}>
                <IntlProvider locale='en'>
                    <NotesPanel/>
                </IntlProvider>
            </Provider>,
        );
        expect(await screen.findByRole('tab', {name: 'This channel'})).toHaveAttribute('aria-selected', 'true');
    });
});
