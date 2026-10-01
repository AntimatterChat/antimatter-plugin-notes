// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React, {forwardRef, useEffect, useImperativeHandle, useState} from 'react';

import type {MentionUser} from '../client';
import {cx} from '../ui/web_ui';

export type MentionListProps = {
    items: MentionUser[];
    command: (attrs: {id: string; label: string}) => void;
    noResults: string;
};

export type MentionListHandle = {
    onKeyDown: (event: KeyboardEvent) => boolean;
};

// MentionList is the list of the users matching what follows the @ being typed.
const MentionList = forwardRef<MentionListHandle, MentionListProps>(({items, command, noResults}, ref) => {
    const [active, setActive] = useState(0);
    useEffect(() => setActive(0), [items]);

    const choose = (index: number) => {
        const user = items[index];
        if (user) {
            command({id: user.id, label: user.username});
        }
    };

    useImperativeHandle(ref, () => ({
        onKeyDown: (event: KeyboardEvent) => {
            if (!items.length) {
                return false;
            }
            switch (event.key) {
            case 'ArrowUp':
                setActive(((active + items.length) - 1) % items.length);
                return true;
            case 'ArrowDown':
                setActive((active + 1) % items.length);
                return true;
            case 'Enter':
            case 'Tab':
                choose(active);
                return true;
            default:
                return false;
            }
        },
    }));

    if (!items.length) {
        return <div className={cx('notes-mention-empty')}>{noResults}</div>;
    }
    return (
        <div
            className={cx('notes-mention-list')}
            role='listbox'
        >
            {items.map((user, i) => (
                <button
                    key={user.id}
                    role='option'
                    aria-selected={i === active}
                    className={cx('notes-mention-item', i === active && 'on')}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(i)}
                >
                    <b>{`@${user.username}`}</b>
                    {user.name && <span>{user.name}</span>}
                </button>
            ))}
        </div>
    );
});
MentionList.displayName = 'MentionList';

export default MentionList;
