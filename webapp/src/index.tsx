// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import {events} from './client';
import NotePost from './components/note_post';
import NotesPanel from './components/notes_panel';
import manifest from './manifest';
import {RelayEvents} from './relay/events';
import type {PluginClass, PluginRegistry, PluginStore, RightHandSidebarRegistration} from './types/host';
import Icon from './ui/icon';
import {setShowPanel} from './ui_state';

import './styles.css';

// The type of the posts sharing a note (server/api.go).
const NOTE_POST_TYPE = 'custom_antimatter_note';

// The icon of the app bar: the mockup's notes icon, in its color.
const appBarIcon = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#A3E635" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 11h8M8 15h8M8 19h5"/></svg>',
);

const title = (
    <FormattedMessage
        id='notes.app'
        defaultMessage='Notes'
    />
);

export default class Plugin implements PluginClass {
    public initialize(registry: PluginRegistry, store: PluginStore) {
        if (window.basename) {
            Client4.setUrl(window.basename);
        }

        for (const event of Object.values(RelayEvents)) {
            registry.registerWebSocketEventHandler(`custom_${manifest.id}_${event}`, (msg) => events.handle(event, msg.data));
        }
        registry.registerReconnectHandler(() => events.reconnected());

        // The app bar opens the notes panel; hosts without it get a channel header button.
        let rhs: RightHandSidebarRegistration;
        const appBar = registry.registerAppBarComponent?.({iconUrl: appBarIcon, tooltipText: title, rhsComponent: NotesPanel, rhsTitle: title});
        if (appBar && typeof appBar === 'object') {
            rhs = appBar.rhsComponent;
        } else {
            rhs = registry.registerRightHandSidebarComponent(NotesPanel, title);
        }
        registry.registerChannelHeaderButtonAction(
            <Icon name='pad'/>,
            () => store.dispatch(rhs.toggleRHSPlugin),
            title,
            title,
        );
        setShowPanel(() => store.dispatch(rhs.showRHSPlugin));

        registry.registerPostTypeComponent(NOTE_POST_TYPE, NotePost);
    }
}

window.registerPlugin(manifest.id, new Plugin());
