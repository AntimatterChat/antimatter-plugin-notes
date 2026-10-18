// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React from 'react';

import {cx} from '../ui/web_ui';

// NoteToolbar is the open note's toolbar: the row at the top of the panel where the note puts its back button, its
// title and its actions, under the host's panel header. The header is the host's and the same for every app (the
// app's icon and name, its size, a new window, close): nothing of the app goes in it. The list has no toolbar: its
// tabs and the header row of its view, with the new note button, top it.
export function NoteToolbar({children}: {children: React.ReactNode}) {
    return (
        <div
            className={cx('notes-bar')}
            data-testid='notes-toolbar'
        >
            {children}
        </div>
    );
}
