// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {cx} from '../ui/web_ui';
import {useOpenDoc} from '../ui_state';

import NoteEditor from './note_editor';
import NoteList from './note_list';

// NotesPanel is the notes app in the right-hand panel: the notes of the current channel and the
// personal notes, or the open note.
export default function NotesPanel() {
    const docId = useOpenDoc();
    const channel = useSelector(getCurrentChannel);

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
