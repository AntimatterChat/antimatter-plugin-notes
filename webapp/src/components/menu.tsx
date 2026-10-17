// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

import Icon, {type IconName} from '../ui/icon';
import {cx, isFusionUI} from '../ui/web_ui';

export type MenuItem = {
    icon: IconName;
    label: string;
    danger?: boolean;
    onClick: () => void;
};

// The gap between the button and its menu, and the margin the menu keeps from the edges of the window.
const GAP = 4;
const MARGIN = 8;

// Menu is a button opening a small menu of actions. The menu is drawn over the page, under the button and aligned
// with its right edge: the button sits in the panel's header, which clips what overflows it.
export default function Menu({label, items}: {label: string; items: MenuItem[]}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [place, setPlace] = useState<React.CSSProperties>({});

    useEffect(() => {
        if (!open) {
            return () => null;
        }
        const close = (e: MouseEvent | KeyboardEvent) => {
            if (e instanceof KeyboardEvent) {
                if (e.key === 'Escape') {
                    setOpen(false);
                }
                return;
            }
            const target = e.target as Node;
            if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) {
                setOpen(false);
            }
        };
        const dismiss = () => setOpen(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        window.addEventListener('resize', dismiss);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
            window.removeEventListener('resize', dismiss);
        };
    }, [open]);

    // Under the button (over it when there's no room below), inside the window
    useLayoutEffect(() => {
        if (!open || !ref.current) {
            return;
        }
        const button = ref.current.getBoundingClientRect();
        const width = menuRef.current?.offsetWidth || 0;
        const height = menuRef.current?.offsetHeight || 0;
        const left = Math.max(MARGIN, Math.min(button.right - width, window.innerWidth - width - MARGIN));
        const below = button.bottom + GAP;
        const above = button.top - GAP - height;
        setPlace({left, top: below + height > window.innerHeight - MARGIN && above > MARGIN ? above : below});
    }, [open]);

    return (
        <div
            ref={ref}
            className={cx('notes-menu-wrap')}
        >
            <button
                type='button'
                className={cx('icon-btn')}
                title={label}
                aria-label={label}
                aria-haspopup='menu'
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                <Icon name='dots'/>
            </button>
            {open && createPortal(

                // Fusion styles what's in its layers
                <div className={(isFusionUI() ? 'am-layer ' : '') + cx('notes-menu-pop')}>
                    <div
                        ref={menuRef}
                        className={cx('notes-menu')}
                        role='menu'
                        aria-label={label}
                        style={place}
                    >
                        {items.map((item) => (
                            <button
                                key={item.label}
                                type='button'
                                role='menuitem'
                                className={cx(item.danger && 'danger')}
                                onClick={() => {
                                    setOpen(false);
                                    item.onClick();
                                }}
                            >
                                <Icon
                                    name={item.icon}
                                    size='sm'
                                />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}
