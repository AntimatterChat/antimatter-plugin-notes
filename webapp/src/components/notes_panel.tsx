// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {cx} from '../ui/web_ui';
import {panelClosed, panelOpened, useOpenDoc} from '../ui_state';

import NoteEditor from './note_editor';
import NoteList from './note_list';

// NotesPanel is the notes app in the right-hand panel: the notes of the current channel and the
// personal notes, or the open note.
export default function NotesPanel() {
    const channel = useSelector(getCurrentChannel);

    // Back in another channel than the one it was closed in, the panel opens on its list
    useState(() => panelOpened(channel?.id || ''));
    const channelId = useRef(channel?.id || '');
    channelId.current = channel?.id || '';
    useEffect(() => () => panelClosed(channelId.current), []);

    const docId = useOpenDoc();

    return (
        <div className={cx('notes-root')}>
            {docId ? (
                <NoteEditor
                    key={docId}
                    docId={docId}
                />
            ) : <NoteList channel={channel}/>}
        </div>
    );
}
