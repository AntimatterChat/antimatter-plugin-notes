// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import {prosemirrorJSONToYDoc} from '@tiptap/y-tiptap';
import {act, fireEvent, render, screen} from '@testing-library/react';
import React, {createRef} from 'react';
import * as Y from 'yjs';

import {Client4} from 'mattermost-redux/client';

import {searchUsers} from '../client';

import {baseExtensions} from './extensions';
import MentionList, {type MentionListHandle} from './mention_list';
import {versionContent} from './note_history';

jest.mock('mattermost-redux/client', () => ({Client4: {autocompleteUsers: jest.fn()}}));

const mentionHTML = '<p>Ask <span data-type="mention" data-id="u1" data-label="ada">@ada</span> today</p>';

// clickWith calls a handleClick prop of an editor as a click on an element would.
function clickWith(editor: Editor, at: number, element: HTMLElement) {
    return (handle: (view: Editor['view'], pos: number, event: MouseEvent) => boolean | void) => Boolean(handle(editor.view, at, {target: element} as unknown as MouseEvent));
}

// pressOn returns a function pressing a key on a mention list.
function pressOn(ref: React.RefObject<MentionListHandle | null>) {
    return (key: string) => {
        let handled: boolean | undefined;
        act(() => {
            handled = ref.current?.onKeyDown(new KeyboardEvent('keydown', {key}));
        });
        return handled;
    };
}

const optionText = (option: HTMLElement) => option.textContent;

function newEditor(onClick?: (username: string) => void) {
    return new Editor({extensions: baseExtensions({onClick}), content: mentionHTML});
}

describe('mention nodes', () => {
    test('keep the user and render as mentions', () => {
        const editor = newEditor();
        const paragraph = editor.getJSON().content?.[0];
        expect(paragraph?.content?.[1]).toEqual({type: 'mention', attrs: {id: 'u1', label: 'ada', mentionSuggestionChar: '@'}});
        expect(editor.getText()).toBe('Ask @ada today');
        const html = editor.getHTML();
        expect(html).toContain('data-type="mention"');
        expect(html).toContain('data-mention="ada"');
        expect(html).toContain('mention-link');
        expect(html).toContain('>@ada</span>');
        editor.destroy();
    });

    test('are kept in the Yjs document of the note', () => {
        const editor = newEditor();
        const ydoc = prosemirrorJSONToYDoc(editor.schema, editor.getJSON(), 'default');
        const content = versionContent(Y.encodeStateAsUpdate(ydoc));
        expect(content.content?.[0].content?.[1]).toMatchObject({type: 'mention', attrs: {id: 'u1', label: 'ada'}});
        editor.destroy();
    });

    test('open the mentioned user when clicked', () => {
        const onClick = jest.fn();
        const editor = newEditor(onClick);
        const element = editor.view.dom.querySelector('[data-type="mention"]') as HTMLElement;
        const pos = editor.view.posAtDOM(element, 0);
        editor.view.someProp('handleClick', clickWith(editor, pos, element));
        expect(onClick).toHaveBeenCalledWith('ada');
        editor.destroy();
    });
});

describe('mention suggestions', () => {
    test('list the users and pick one with the keyboard or the mouse', () => {
        const command = jest.fn();
        const ref = createRef<MentionListHandle>();
        render(
            <MentionList
                ref={ref}
                items={[{id: 'u1', username: 'ada', name: 'Ada Lovelace'}, {id: 'u2', username: 'kenji', name: ''}]}
                command={command}
                noResults='No one'
            />,
        );
        expect(screen.getAllByRole('option').map(optionText)).toEqual(['@adaAda Lovelace', '@kenji']);

        const press = pressOn(ref);
        press('ArrowDown');
        expect(press('Enter')).toBe(true);
        expect(command).toHaveBeenLastCalledWith({id: 'u2', label: 'kenji'});

        fireEvent.click(screen.getByText('@ada'));
        expect(command).toHaveBeenLastCalledWith({id: 'u1', label: 'ada'});
        expect(press('x')).toBe(false);
    });

    test('say when no one matches', () => {
        render(
            <MentionList
                items={[]}
                command={jest.fn()}
                noResults='No one'
            />,
        );
        expect(screen.getByText('No one')).toBeInTheDocument();
    });

    test("search the note's channel first, or the whole server", async () => {
        const autocomplete = Client4.autocompleteUsers as jest.Mock;
        autocomplete.mockResolvedValue({
            users: [{id: 'u1', username: 'ada', first_name: 'Ada', last_name: 'Lovelace', delete_at: 0}],
            out_of_channel: [{id: 'u2', username: 'old', delete_at: 1}, {id: 'u3', username: 'kenji', nickname: 'K', delete_at: 0}],
        });
        expect(await searchUsers('a', 'team', 'channel')).toEqual([
            {id: 'u1', username: 'ada', name: 'Ada Lovelace'},
            {id: 'u3', username: 'kenji', name: 'K'},
        ]);
        expect(autocomplete).toHaveBeenLastCalledWith('a', 'team', 'channel', {limit: 8});

        await searchUsers('', 'team', '');
        expect(autocomplete).toHaveBeenLastCalledWith('', '', '', {limit: 8});
    });
});
