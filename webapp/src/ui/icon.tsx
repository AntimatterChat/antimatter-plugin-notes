// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import React from 'react';

import {cx, isFusionUI} from './web_ui';

// The icons used by the plugin: Fusion's icon sprite names, and the classic UI's compass icons.
const classicIcons = {
    bold: 'format-bold',
    italic: 'format-italic',
    strike: 'format-strikethrough-variant',
    heading: 'format-header',
    ul: 'format-list-bulleted',
    ol: 'format-list-numbered',
    checkbox: 'checkbox-marked-outline',
    quote: 'format-quote-open',
    code: 'code-tags',
    undo: 'arrow-u-left-top',
    pad: 'file-document-outline',
    plus: 'plus',
    dots: 'dots-vertical',
    x: 'close',
    chev: 'chevron-left',
    export: 'download-outline',
    forward: 'share-variant-outline',
    clock: 'clock-outline',
    trash: 'trash-can-outline',
    pen: 'pencil-outline',
    lock: 'lock-outline',
    users: 'account-multiple-outline',
} as const;

export type IconName = keyof typeof classicIcons;

type Props = {
    name: IconName;
    size?: 'sm' | 'xs';
};

export default function Icon({name, size}: Props) {
    if (isFusionUI()) {
        return (
            <svg
                className={cx('ic', size, name === 'chev' && 'ic-back')}
                aria-hidden='true'
            >
                <use href={`#am-i-${name}`}/>
            </svg>
        );
    }
    return (
        <i
            className={`icon icon-${classicIcons[name]}`}
            aria-hidden='true'
        />
    );
}
