// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import {mergeAttributes} from '@tiptap/core';
import Mention from '@tiptap/extension-mention';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {ReactRenderer} from '@tiptap/react';
import type {SuggestionOptions, SuggestionProps} from '@tiptap/suggestion';

import type {MentionUser} from '../client';
import {mentionUsername} from '../mentions';
import {cx, isFusionUI} from '../ui/web_ui';

import MentionList, {type MentionListHandle, type MentionListProps} from './mention_list';

// Mentions name users in a note like @username in a message, and link to them. They're part of
// the note's document (nodes with the user's ID and username), and notify no one.

export type MentionOptions = {

    // search returns the users matching a text, for the suggestions; none in read-only views
    search?: (query: string) => Promise<MentionUser[]>;

    // noResults is the text shown when no user matches
    noResults?: string;

    // onClick opens a mentioned user
    onClick?: (username: string) => void;
};

// suggestionPopup shows the suggestions under the caret, in a layer of the page.
function suggestionPopup(noResults: string): SuggestionOptions<MentionUser>['render'] {
    return () => {
        let renderer: ReactRenderer<MentionListHandle, MentionListProps> | null = null;
        let popup: HTMLDivElement | null = null;

        const place = (props: SuggestionProps<MentionUser>) => {
            const rect = props.clientRect?.();
            if (!popup || !rect) {
                return;
            }
            const below = rect.bottom + 4;
            const above = rect.top - 4 - popup.offsetHeight;
            popup.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - popup.offsetWidth - 4))}px`;
            popup.style.top = `${below + popup.offsetHeight > window.innerHeight && above > 0 ? above : below}px`;
        };
        const listProps = (props: SuggestionProps<MentionUser>): MentionListProps => ({
            items: props.items,
            command: (attrs) => props.command(attrs),
            noResults,
        });

        return {
            onStart: (props) => {
                renderer = new ReactRenderer(MentionList, {props: listProps(props), editor: props.editor});
                popup = document.createElement('div');

                // Fusion styles what's in its layers
                popup.className = (isFusionUI() ? 'am-layer ' : '') + cx('notes-mention-popup');
                popup.appendChild(renderer.element);
                document.body.appendChild(popup);
                place(props);
            },
            onUpdate: (props) => {
                renderer?.updateProps(listProps(props));
                place(props);
            },
            onKeyDown: ({event}) => {
                if (event.key === 'Escape') {
                    popup?.remove();
                    return true;
                }
                return renderer?.ref?.onKeyDown(event) ?? false;
            },
            onExit: () => {
                popup?.remove();
                renderer?.destroy();
                popup = null;
                renderer = null;
            },
        };
    };
}

// mentionAt returns the username of the mention an event happened on, if any.
export function mentionAt(target: EventTarget | null): string | null {
    const element = (target as HTMLElement | null)?.closest?.('[data-type="mention"]');
    return element ? element.getAttribute('data-mention') : null;
}

// noteMention is the mention node of notes, with suggestions where users are searched, which opens
// the mentioned user when clicked.
export function noteMention(options: MentionOptions = {}) {
    const {search, onClick} = options;
    return Mention.extend({
        addProseMirrorPlugins() {
            const plugins = search ? this.parent?.() || [] : [];
            if (onClick) {
                plugins.push(new Plugin({
                    key: new PluginKey('noteMentionClick'),
                    props: {
                        handleClick: (_view, _pos, event) => {
                            const username = mentionAt(event.target);
                            if (!username) {
                                return false;
                            }
                            onClick(username);
                            return true;
                        },
                    },
                }));
            }
            return plugins;
        },
    }).configure({
        HTMLAttributes: {class: `${cx('notes-mention')} mention-link`},
        renderText: ({node}) => `@${mentionUsername(node.attrs.label ?? node.attrs.id)}`,
        renderHTML: ({options: mentionOptions, node}) => [
            'span',
            mergeAttributes({'data-type': 'mention', 'data-mention': mentionUsername(node.attrs.label)}, mentionOptions.HTMLAttributes),
            `@${mentionUsername(node.attrs.label ?? node.attrs.id)}`,
        ],
        suggestion: {
            char: '@',
            items: async ({query}) => (search ? search(query) : []),
            render: suggestionPopup(options.noResults || ''),
        },
    });
}
