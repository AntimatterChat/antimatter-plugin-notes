// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React, {useLayoutEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {FormattedMessage} from 'react-intl';

import {cx} from '../ui/web_ui';
import {clearHeadSlot, setHeadSlot, useHeadSlot, useOpenDoc} from '../ui_state';

// NotesHeader is the title the notes app gives the host's panel header: "Notes" over the list (whose + is in the
// header row of its view, under the tabs, as in Todo and Whiteboard), and a row where the open note draws its own
// header (the note's title, back to the list, its actions), so that a note has one header, the panel's, instead of
// one under another.
export default function NotesHeader() {
    const docId = useOpenDoc();
    const [slot, setSlot] = useState<HTMLSpanElement | null>(null);

    useLayoutEffect(() => {
        if (!slot) {
            return () => null;
        }
        setHeadSlot(slot);
        return () => clearHeadSlot(slot);
    }, [slot]);

    return (
        <span className={cx('notes-head', docId && 'notes-head-note')}>
            {!docId && (
                <span className={cx('notes-head-label')}>
                    <FormattedMessage
                        id='notes.app'
                        defaultMessage='Notes'
                    />
                </span>
            )}
            <span
                ref={setSlot}
                className={cx('notes-head-slot')}
            />
        </span>
    );
}

// HeadPortal shows its children in the panel's header, or, on a host that doesn't show the app's title, in a bar at
// the top of the panel.
export function HeadPortal({children}: {children: React.ReactNode}) {
    const slot = useHeadSlot();
    if (slot) {
        return createPortal(children, slot);
    }
    return <div className={cx('notes-bar')}>{children}</div>;
}
