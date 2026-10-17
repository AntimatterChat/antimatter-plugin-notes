// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {legacy_createStore as createStore} from 'redux';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {client} from '../client';
import type {Doc} from '../relay/client';
import {setListView, setOpenDoc} from '../ui_state';

import {FUSION_LAYER_ID} from './fusion/fusion_ui';
import NotePost from './note_post';
import NotesPanel from './notes_panel';

// Notes under the Fusion UI: its confirmation dialog, its tooltips, its empty states and the app's colour.

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

// The editor itself is tested in collab_editor.test.tsx
jest.mock('./collab_editor', () => {
    const {createElement} = jest.requireActual('react');
    return {
        __esModule: true,
        default: ({meta}: {meta: unknown}) => createElement('div', {'data-testid': 'editor'}, meta),
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

const setWebUI = (ui?: 'classic' | 'fusion') => {
    window.antimatterWebUI = ui;
    if (ui) {
        document.documentElement.dataset.amWebUi = ui;
    } else {
        delete document.documentElement.dataset.amWebUi;
    }
};

function store(channel: Channel = townSquare) {
    const state = {
        entities: {
            general: {config: {}, license: {}},
            preferences: {myPreferences: {}},
            users: {currentUserId: 'me', profiles: {me: {id: 'me', username: 'maya'}}, statuses: {}, profilesInChannel: {}},
            channels: {currentChannelId: channel.id, channels: {[channel.id]: channel}, myMembers: {}},
            teams: {currentTeamId: 't1', teams: {t1: {id: 't1', name: 'lumen'}}},
        },
    };
    return createStore(() => state);
}

function renderApp(channel?: Channel) {
    render(
        <Provider store={store(channel)}>
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
const noToolbar = () => expect(screen.queryByTestId('notes-toolbar')).not.toBeInTheDocument();
const panel = () => within(screen.getByTestId('panel'));
const sectionHead = () => within(screen.getByTestId('notes-section-head'));
const titled = () => Array.from(document.querySelectorAll('[data-testid="panel"] [title]'));

let layer: HTMLElement;

beforeEach(() => {
    jest.clearAllMocks();
    setOpenDoc(null);
    setListView('channel');
    mocked.listDocs.mockResolvedValue([]);
    mocked.listFavorites.mockResolvedValue([]);
    mocked.getDoc.mockResolvedValue(note);
    mocked.deleteDoc.mockResolvedValue(null as never);
    mocked.getVersions.mockResolvedValue([]);
    layer = document.createElement('div');
    layer.id = FUSION_LAYER_ID;
    layer.className = 'am-layer';
    document.body.appendChild(layer);
    setWebUI('fusion');
});

afterEach(() => {
    layer.remove();
    setWebUI(undefined);
});

describe('deleting a note under Fusion', () => {
    test("asks with Fusion's dialog, not the browser's, and deletes only once confirmed", async () => {
        const browserConfirm = jest.spyOn(window, 'confirm');
        setOpenDoc('n1');
        renderApp();

        fireEvent.click(await header().findByRole('button', {name: 'Note actions'}));
        fireEvent.click(screen.getByRole('menuitem', {name: 'Delete'}));
        let dialog = await screen.findByRole('alertdialog', {name: 'Delete "Plan"?'});
        expect(layer).toContainElement(dialog);
        expect(within(dialog).getByText('It\'s deleted for everyone. This can\'t be undone.')).toBeInTheDocument();

        // Cancel keeps it
        fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(mocked.deleteDoc).not.toHaveBeenCalled();

        // Delete deletes it, and goes back to the list
        fireEvent.click(header().getByRole('button', {name: 'Note actions'}));
        fireEvent.click(screen.getByRole('menuitem', {name: 'Delete'}));
        dialog = await screen.findByRole('alertdialog', {name: 'Delete "Plan"?'});
        const confirm = within(dialog).getByRole('button', {name: 'Delete'});
        expect(confirm).toHaveClass('am-btn', 'am-danger');
        fireEvent.click(confirm);
        await waitFor(() => expect(mocked.deleteDoc).toHaveBeenCalledWith('n1'));
        await waitFor(noToolbar);

        expect(browserConfirm).not.toHaveBeenCalled();
        browserConfirm.mockRestore();
    });

    test('an untitled note is "this note"', async () => {
        mocked.getDoc.mockResolvedValue({...note, title: ''});
        setOpenDoc('n1');
        renderApp();

        fireEvent.click(await header().findByRole('button', {name: 'Note actions'}));
        fireEvent.click(screen.getByRole('menuitem', {name: 'Delete'}));
        const dialog = await screen.findByRole('alertdialog', {name: 'Delete this note?'});
        fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    });
});

describe('tooltips under Fusion', () => {
    test("the list's + gives Fusion's tooltip, and nothing a browser tooltip", async () => {
        renderApp();

        await panel().findByText('No notes here yet');
        const add = sectionHead().getByRole('button', {name: 'New note in this channel'});
        expect(add).toHaveAttribute('data-am-tip', 'New note in this channel');
        noToolbar();
        expect(titled()).toEqual([]);
    });

    test("an open note's header gives Fusion's tooltips, and no browser tooltips", async () => {
        setOpenDoc('n1');
        renderApp();

        expect(await header().findByRole('button', {name: 'Note actions'})).toHaveAttribute('data-am-tip', 'Note actions');
        expect(header().getByRole('button', {name: 'All notes'})).toHaveAttribute('data-am-tip', 'All notes');
        expect(header().getByRole('button', {name: 'Add to favourites'})).toHaveAttribute('data-am-tip', 'Add to favourites');
        expect(header().getByRole('img', {name: 'Shared with everyone in ~Town Square'})).toHaveAttribute('data-am-tip', 'Shared with everyone in ~Town Square');
        expect(titled()).toEqual([]);
    });

    test("the classic UI keeps the browser's tooltips", async () => {
        setWebUI('classic');
        renderApp();

        const add = await panel().findByRole('button', {name: 'New note in this channel'});
        expect(add).toHaveAttribute('title', 'New note in this channel');
        expect(add).not.toHaveAttribute('data-am-tip');
        expect(document.querySelector('[data-am-tip]')).toBeNull();
    });
});

describe('empty states under Fusion', () => {
    test("a channel without notes: Fusion's empty state, with the new note button as its action", async () => {
        mocked.createDoc.mockResolvedValue({...note, id: 'n2', title: ''});
        renderApp();

        const title = await panel().findByText('No notes here yet');
        const empty = title.closest('[data-empty-state]') as HTMLElement;
        expect(empty).toHaveClass('am-empty', 'amfx-empty');
        expect(empty.querySelector('.amfx-empty-ic use')).toHaveAttribute('href', '#am-i-pad');
        expect(within(empty).getByText('Every member of the channel can edit the notes added here.')).toBeInTheDocument();
        expect(within(empty).getByRole('button', {name: 'New note in this channel'})).toHaveClass('am-btn', 'am-primary');
        fireEvent.click(within(empty).getByRole('button', {name: 'New note in this channel'}));
        await waitFor(() => expect(mocked.createDoc).toHaveBeenCalledWith('', 'c1'));
    });

    test('your personal notes and the starred ones, when there are none', async () => {
        setListView('mine');
        renderApp();
        expect(await panel().findByText('No personal notes yet')).toBeInTheDocument();
        expect(panel().getByText('Only you can see your personal notes.')).toBeInTheDocument();

        fireEvent.click(panel().getByRole('tab', {name: 'Favourites'}));
        const title = await panel().findByText('Nothing starred yet');
        expect(title.closest('[data-empty-state]')).toHaveClass('am-empty', 'amfx-empty');
        expect(within(title.closest('[data-empty-state]') as HTMLElement).queryByRole('button')).toBeNull();
    });

    test('loading is a quiet line that says what loads, not an ellipsis', async () => {
        mocked.listDocs.mockReturnValue(new Promise(() => null));
        renderApp();

        const busy = await panel().findByRole('status');
        expect(busy).toHaveTextContent('Loading notes…');
        expect(busy).toHaveClass('am-empty', 'amfx-empty', 'amfx-busy');
        expect(busy).toHaveAttribute('aria-busy', 'true');
        expect(panel().queryByText('…')).toBeNull();
    });

    test('a note opening', async () => {
        mocked.getDoc.mockReturnValue(new Promise(() => null));
        setOpenDoc('n1');
        renderApp();
        expect(await panel().findByRole('status')).toHaveTextContent('Opening the note…');
    });

    test('the versions of a note that has none', async () => {
        setOpenDoc('n1');
        renderApp();
        fireEvent.click(await header().findByRole('button', {name: 'Note actions'}));
        fireEvent.click(screen.getByRole('menuitem', {name: 'Version history'}));
        const title = await panel().findByText('No past versions yet');
        expect(title.closest('[data-empty-state]')).toHaveClass('am-empty', 'amfx-empty');
        expect(panel().getByText('Versions are kept every 10 minutes or so while a note is edited.')).toBeInTheDocument();
    });

    test('a note that was deleted is an error in the danger tone', async () => {
        mocked.getDoc.mockRejectedValue({status: 404, message: 'not found'});
        setOpenDoc('n1');
        renderApp();
        const text = await panel().findByText('This note was deleted, or you can\'t open it.');
        expect(text.closest('[data-empty-state]')).toHaveClass('am-empty', 'amfx-empty', 'amfx-danger');
    });

    test('an archived channel offers no action', async () => {
        renderApp({...townSquare, delete_at: 5});
        const title = await panel().findByText('No notes here yet');
        expect(within(title.closest('[data-empty-state]') as HTMLElement).queryByRole('button')).toBeNull();
    });

    test('the classic UI keeps its own empty state, the + only in the header row', async () => {
        setWebUI('classic');
        renderApp();
        const title = await panel().findByText('No notes here yet');
        expect(title.closest('[data-empty-state]')).toHaveClass('amn-notes-empty');
        expect(title.closest('[data-empty-state]')).not.toHaveClass('am-empty');
        expect(within(title.closest('[data-empty-state]') as HTMLElement).queryByRole('button')).toBeNull();
        expect(panel().getAllByRole('button', {name: 'New note in this channel'})).toHaveLength(1);
    });
});

describe("the app's colour", () => {
    test('the panel and the card of a shared note take Notes\' colour as --am-cc (the card\'s edge)', async () => {
        renderApp();
        const root = await waitFor(() => {
            const el = screen.getByTestId('panel').firstElementChild as HTMLElement;
            expect(el).toHaveClass('am-notes-root');
            return el;
        });
        expect(root.style.getPropertyValue('--am-cc')).toBe('#A3E635');

        render(
            <IntlProvider locale='en'>
                <NotePost post={{id: 'p1', props: {doc_id: 'n1', title: 'Plan'}} as unknown as Post}/>
            </IntlProvider>,
        );
        const card = screen.getByTestId('notes-card');
        expect(card).toHaveClass('am-card', 'am-notes-card');
        expect(card.style.getPropertyValue('--am-cc')).toBe('#A3E635');
        expect(await within(card).findByRole('button', {name: 'Open note'})).toBeInTheDocument();
    });
});
