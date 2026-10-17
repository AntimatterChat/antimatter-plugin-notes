// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {panelStateOf, parsePanelState} from '../panel_state';
import {cx} from '../ui/web_ui';
import {panelClosed, panelOpened, panelRestored, restorePanel, useListView, useOpenDoc} from '../ui_state';

import NoteEditor from './note_editor';
import NoteList from './note_list';

// The props the host gives the panel (Antimatter's Fusion UI): where the panel is goes to setPanelState, and a
// panel opened in a new window gets the state it had as initialPanelState. Other hosts give neither.
type Props = {
    setPanelState?: (state: string | null) => void;
    initialPanelState?: string;
};

// NotesPanel is the notes app in the right-hand panel: the notes of the current channel and the
// personal notes, or the open note.
export default function NotesPanel({setPanelState, initialPanelState}: Props) {
    const channel = useSelector(getCurrentChannel);

    // Back in another channel than the one it was closed in, the panel opens on its list. Opened in a new window,
    // it starts where it was: the note, or its versions, or the list it showed. The note is fetched again as the
    // person signed in here, so one they can no longer open shows its not-found view, with the way back to the list.
    const [restored] = useState(() => {
        panelOpened(channel?.id || '');
        const place = parsePanelState(initialPanelState);
        if (place) {
            restorePanel(place.docId, place.listView);
        }
        return place;
    });
    useLayoutEffect(() => {
        if (restored) {
            panelRestored();
        }
    }, [restored]);
    const channelId = useRef(channel?.id || '');
    channelId.current = channel?.id || '';
    useEffect(() => () => panelClosed(channelId.current), []);

    const docId = useOpenDoc();
    const listView = useListView();

    // The open note's versions are part of where the panel is, for the note shown with them
    const [historyOf, setHistoryOf] = useState<string | null>(restored?.history ? restored.docId : null);
    const onViewChange = useCallback((id: string, view: 'edit' | 'history') => {
        setHistoryOf((current) => {
            if (view === 'history') {
                return id;
            }
            return current === id ? null : current;
        });
    }, []);
    useEffect(() => {
        setHistoryOf((current) => (current === docId ? current : null));
    }, [docId]);

    const state = panelStateOf({docId, history: Boolean(docId) && historyOf === docId, listView});
    useEffect(() => {
        setPanelState?.(state || null);
    }, [setPanelState, state]);

    return (
        <div className={cx('notes-root')}>
            {docId ? (
                <NoteEditor
                    key={docId}
                    docId={docId}
                    initialView={historyOf === docId ? 'history' : 'edit'}
                    onViewChange={onViewChange}
                />
            ) : <NoteList channel={channel}/>}
        </div>
    );
}
