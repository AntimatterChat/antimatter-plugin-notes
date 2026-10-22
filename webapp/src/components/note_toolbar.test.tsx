// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {legacy_createStore as createStore} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {client} from '../client';
import type {Doc} from '../relay/client';
import {setListView, setOpenDoc} from '../ui_state';

import NotesPanel from './notes_panel';

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

// The session of an open note, synced and alone in it
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

// The editor itself (Tiptap and Yjs) is tested in collab_editor.test.tsx: here, whether it can edit, and the meta
// it shows in its toolbar's row.
jest.mock('./collab_editor', () => {
    const {createElement} = jest.requireActual('react');
    return {
        __esModule: true,
        default: ({editable, meta}: {editable: boolean; meta: unknown}) => createElement('div', {'data-testid': 'editor', 'data-editable': String(editable)}, meta),
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

function storeWith(channel: Channel | null) {
    const state = {
        entities: {
            general: {config: {}, license: {}},
            preferences: {myPreferences: {}},
            users: {currentUserId: 'me', profiles: {me: {id: 'me', username: 'maya'}}, statuses: {}, profilesInChannel: {}},
            channels: {currentChannelId: channel?.id || '', channels: channel ? {[channel.id]: channel} : {}, myMembers: {}},
            teams: {currentTeamId: 't1', teams: {t1: {id: 't1', name: 'lumen'}}},
        },
    };
    return createStore(() => state);
}

// renderApp renders the notes panel as the host does, under the host's header (which only names the app).
function renderApp({channel = townSquare}: {channel?: Channel | null} = {}) {
    render(
        <Provider store={storeWith(channel)}>
            <IntlProvider locale='en'>
                <div data-testid='panel'>
                    <NotesPanel/>
                </div>
            </IntlProvider>
        </Provider>,
    );
}

// The open note's toolbar, at the top of the panel; the list has none.
const header = () => within(screen.getByTestId('notes-toolbar'));

// The toolbar once it shows (a note opens after it loads).
const toolbar = async () => within(await screen.findByTestId('notes-toolbar'));
const noToolbar = () => expect(screen.queryByTestId('notes-toolbar')).not.toBeInTheDocument();

// The header row of the list's view, under its tabs
const sectionHead = () => screen.getByTestId('notes-section-head');

// Helpers in act, and the text of an element (the tests' callbacks nest no deeper)
const focus = (element: HTMLElement) => act(() => element.focus());
const textOf = (element: Element) => element.textContent;
const panel = () => within(screen.getByTestId('panel'));

beforeEach(() => {
    jest.clearAllMocks();
    setOpenDoc(null);
    setListView('channel');
    mocked.listDocs.mockResolvedValue([]);
    mocked.listFavorites.mockResolvedValue([]);
    mocked.getDoc.mockResolvedValue(note);
    mocked.renameDoc.mockResolvedValue(note);
    mocked.setFavorite.mockResolvedValue(null as never);
    mocked.deleteDoc.mockResolvedValue(null as never);
    mocked.getVersions.mockResolvedValue([]);
});

describe('the list', () => {
    test("has no toolbar of its own (the host's header names the app), and the new note button in the view's header row, under the tabs", async () => {
        mocked.createDoc.mockResolvedValue({...note, id: 'n2', title: ''});
        renderApp();

        noToolbar();
        expect(await panel().findByText('No notes here yet')).toBeInTheDocument();
        const add = panel().getByRole('button', {name: 'New note in this channel'});

        // The row says where the view's notes are shared, the + on its right; the panel's header has no +
        expect(sectionHead()).toContainElement(add);
        expect(sectionHead()).toHaveTextContent('Shared with Town Square');
        expect(sectionHead().previousElementSibling).toBe(panel().getByRole('tablist'));
        expect(panel().getByRole('tab', {name: 'This channel'})).not.toHaveAttribute('title');

        fireEvent.click(add);
        expect(mocked.createDoc).toHaveBeenCalledWith('', 'c1');

        // The new note opens, its title in its toolbar
        expect(await (await toolbar()).findByRole('textbox', {name: 'Title'})).toBeInTheDocument();
    });

    test('adds a personal note from your notes, none from the favorites', async () => {
        mocked.createDoc.mockResolvedValue({...note, id: 'n2', channel_id: ''});
        renderApp();

        fireEvent.click(panel().getByRole('tab', {name: 'Mine'}));
        expect(await panel().findByText('Personal notes')).toBe(sectionHead().firstElementChild);
        fireEvent.click(within(sectionHead()).getByRole('button', {name: 'New personal note'}));
        expect(mocked.createDoc).toHaveBeenCalledWith('', '');

        // The new note opens; back to the list
        fireEvent.click(await (await toolbar()).findByRole('button', {name: 'All notes'}));
        fireEvent.click(panel().getByRole('tab', {name: 'Favourites'}));
        expect(await panel().findByText('Star a note to find it here, wherever it is.')).toBeInTheDocument();
        expect(sectionHead()).toHaveTextContent('Favourites');
        expect(within(sectionHead()).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /New/})).not.toBeInTheDocument();
    });

    test('adds no note to an archived channel', async () => {
        renderApp({channel: {...townSquare, delete_at: 5}});
        expect(await panel().findByText(/No notes here yet/)).toBeInTheDocument();
        expect(sectionHead()).toHaveTextContent('Shared with Town Square');
        expect(within(sectionHead()).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /New/})).not.toBeInTheDocument();
    });

    test('in a direct message, its notes are shared with "this conversation"', async () => {
        mocked.createDoc.mockResolvedValue({...note, id: 'n2', channel_id: 'd1'});
        renderApp({channel: {id: 'd1', type: 'D', display_name: 'bob', name: 'me__bob', delete_at: 0} as Channel});
        expect(await panel().findByText('Every member of the conversation can edit the notes added here.')).toBeInTheDocument();
        expect(sectionHead()).toHaveTextContent('Shared with this conversation');
        fireEvent.click(within(sectionHead()).getByRole('button', {name: 'New note in this conversation'}));
        expect(mocked.createDoc).toHaveBeenCalledWith('', 'd1');
        expect(await (await toolbar()).findByRole('textbox', {name: 'Title'})).toBeInTheDocument();
    });

    test('lists the notes under the header row, with the + still in it', async () => {
        mocked.listDocs.mockImplementation((channelId?: string) => Promise.resolve(channelId ? [note] : []));
        renderApp();
        const row = (await panel().findByText('Plan')).closest('button') as HTMLElement;
        expect(sectionHead().nextElementSibling).toBe(row);
        expect(within(sectionHead()).getByRole('button', {name: 'New note in this channel'})).toBeInTheDocument();
        expect(panel().queryByText('No notes here yet')).not.toBeInTheDocument();
    });
});

describe('an open note', () => {
    test("shows back, its title, where it's shared, the star and its actions in its toolbar, at the top of the panel", async () => {
        setOpenDoc('n1');
        renderApp();

        const title = await (await toolbar()).findByRole('textbox', {name: 'Title'});
        expect(title).toHaveValue('Plan');
        expect(header().getByRole('button', {name: 'All notes'})).toBeInTheDocument();
        expect(header().getByRole('img', {name: 'Shared with everyone in #Town Square'})).toBeInTheDocument();
        expect(header().getByRole('button', {name: 'Add to favourites'})).toBeInTheDocument();
        expect(header().getByRole('button', {name: 'Note actions'})).toBeInTheDocument();

        // Once, in the panel, over the editor and its toolbar's row
        expect(panel().getAllByRole('textbox', {name: 'Title'})).toHaveLength(1);
        expect(panel().getAllByRole('button', {name: 'All notes'})).toHaveLength(1);
        const bar = screen.getByTestId('notes-toolbar');
        expect(bar.compareDocumentPosition(panel().getByTestId('editor')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(panel().getByTestId('editor')).toHaveAttribute('data-editable', 'true');
        expect(within(panel().getByTestId('editor')).getByRole('status')).toHaveTextContent('Saved');
    });

    test('is renamed in the header', async () => {
        setOpenDoc('n1');
        renderApp();

        const title = await (await toolbar()).findByRole('textbox', {name: 'Title'});
        focus(title);
        fireEvent.change(title, {target: {value: 'Plan for Q4'}});
        fireEvent.keyDown(title, {key: 'Enter'});
        expect(mocked.renameDoc).toHaveBeenCalledWith('n1', 'Plan for Q4');
    });

    test('is starred from the header', async () => {
        setOpenDoc('n1');
        renderApp();

        fireEvent.click(await (await toolbar()).findByRole('button', {name: 'Add to favourites'}));
        expect(mocked.setFavorite).toHaveBeenCalledWith('n1', true);
        expect(header().getByRole('button', {name: 'Remove from favourites'})).toHaveAttribute('aria-pressed', 'true');
    });

    test('goes back to the list from the header', async () => {
        setOpenDoc('n1');
        renderApp();

        fireEvent.click(await (await toolbar()).findByRole('button', {name: 'All notes'}));
        noToolbar();
        expect(await panel().findByText('No notes here yet')).toBeInTheDocument();
        expect(panel().getByRole('button', {name: 'New note in this channel'})).toBeInTheDocument();
        expect(panel().queryByTestId('editor')).not.toBeInTheDocument();
    });

    test('opens its actions over the page, as the toolbar clips what overflows it', async () => {
        setOpenDoc('n1');
        renderApp();

        const actions = await (await toolbar()).findByRole('button', {name: 'Note actions'});
        fireEvent.click(actions);
        const menu = screen.getByRole('menu', {name: 'Note actions'});
        expect(screen.getByTestId('notes-toolbar')).not.toContainElement(menu);
        expect(within(menu).getAllByRole('menuitem').map(textOf)).toEqual(['Export as Markdown', 'Share in the channel', 'Version history', 'Delete']);
        expect(actions).toHaveAttribute('aria-expanded', 'true');

        // A click in the menu isn't a click outside it; Escape and a click outside close it
        fireEvent.mouseDown(within(menu).getByRole('menuitem', {name: 'Version history'}));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.keyDown(document, {key: 'Escape'});
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        fireEvent.click(actions);
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    test('shows its versions with the header, and back to the note', async () => {
        setOpenDoc('n1');
        renderApp();

        fireEvent.click(await (await toolbar()).findByRole('button', {name: 'Note actions'}));
        fireEvent.click(screen.getByRole('menuitem', {name: 'Version history'}));
        expect(header().getByText('Versions of Plan')).toBeInTheDocument();
        expect(header().queryByRole('textbox', {name: 'Title'})).not.toBeInTheDocument();
        expect(panel().queryByTestId('editor')).not.toBeInTheDocument();
        expect(await panel().findByText(/No past versions yet/)).toBeInTheDocument();

        fireEvent.click(header().getByRole('button', {name: 'All notes'}));
        expect(header().getByRole('textbox', {name: 'Title'})).toBeInTheDocument();
        expect(panel().getByTestId('editor')).toBeInTheDocument();
    });

    test('is deleted from its actions', async () => {
        const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
        setOpenDoc('n1');
        renderApp();

        fireEvent.click(await (await toolbar()).findByRole('button', {name: 'Note actions'}));
        fireEvent.click(screen.getByRole('menuitem', {name: 'Delete'}));

        // The classic UI keeps the browser's confirmation
        expect(confirm).toHaveBeenCalledWith('Delete "Plan"?\n\nIt\'s deleted for everyone. This can\'t be undone.');
        await waitFor(() => expect(mocked.deleteDoc).toHaveBeenCalledWith('n1'));
        await waitFor(noToolbar);
        confirm.mockRestore();
    });

    test("you can't edit: no formatting tools, read only, a title you can't change", async () => {
        mocked.getDoc.mockResolvedValue({...note, can_edit: false, can_delete: false});
        setOpenDoc('n1');
        renderApp();

        expect(await (await toolbar()).findByRole('textbox', {name: 'Title'})).toHaveAttribute('readonly');
        expect(panel().getByTestId('editor')).toHaveAttribute('data-editable', 'false');
        expect(within(panel().getByTestId('editor')).getByRole('status')).toHaveTextContent('Read only');
    });

    test("shows a personal note's lock in the header", async () => {
        mocked.getDoc.mockResolvedValue({...note, channel_id: '', owner_id: 'me'});
        setOpenDoc('n1');
        renderApp();

        expect(await (await toolbar()).findByRole('img', {name: 'Personal: only you can see it'})).toBeInTheDocument();
    });

    test("is in the panel whatever the host's header: its toolbar tops the panel", async () => {
        setOpenDoc('n1');
        renderApp();

        expect(await panel().findByRole('textbox', {name: 'Title'})).toHaveValue('Plan');
        expect(panel().getByRole('button', {name: 'All notes'})).toBeInTheDocument();
        expect(panel().getByRole('button', {name: 'Note actions'})).toBeInTheDocument();
    });

    test('keeps its back button while it loads, or when it fails', async () => {
        mocked.getDoc.mockRejectedValue(Object.assign(new Error('gone'), {status: 404}));
        setOpenDoc('n1');
        renderApp();

        expect(await panel().findByText("This note was deleted, or you can't open it.")).toBeInTheDocument();
        fireEvent.click(header().getByRole('button', {name: 'All notes'}));
        noToolbar();
    });

    test("its back button is a chevron alone: the host's header has the app's icon", async () => {
        setOpenDoc('n1');
        renderApp();

        const back = await (await toolbar()).findByRole('button', {name: 'All notes'});
        expect(back.querySelectorAll('svg, i, img')).toHaveLength(1);
    });
});
