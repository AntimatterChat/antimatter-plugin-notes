// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import type {Extensions} from '@tiptap/core';
import {TaskItem, TaskList} from '@tiptap/extension-list';
import StarterKit from '@tiptap/starter-kit';

// baseExtensions are the content features of notes, shared by the editor and the read-only
// previews of past versions. Undo and redo come from the collaboration extension.
export function baseExtensions(): Extensions {
    return [
        StarterKit.configure({
            undoRedo: false,
            link: {openOnClick: true, autolink: true, HTMLAttributes: {rel: 'noopener noreferrer nofollow', target: '_blank'}},
        }),
        TaskList,
        TaskItem.configure({nested: true}),
    ];
}
