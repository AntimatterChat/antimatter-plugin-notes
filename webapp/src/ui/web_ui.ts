// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

import type {CSSProperties} from 'react';

// Antimatter ships two web UIs: the classic one and Fusion. Under Fusion, the plugin draws the
// markup of the Fusion mockup (its am- classes, styled by Fusion); under the classic UI, the same
// markup with the plugin's own classic styles. Both UIs say which one is running before plugins
// load.

export type WebUI = 'classic' | 'fusion';

// isFusionUI returns whether the Fusion web UI is running.
export function isFusionUI(): boolean {
    return window.antimatterWebUI === 'fusion' || document.documentElement.dataset.amWebUi === 'fusion';
}

// cx returns the classes of the running UI for the mockup's class names: am-<name> under Fusion,
// amn-<name> (styled by the plugin) under the classic UI. Falsy names are skipped.
export function cx(...names: Array<string | false | null | undefined>): string {
    const prefix = isFusionUI() ? 'am-' : 'amn-';
    return names.filter(Boolean).map((name) => prefix + name).join(' ');
}

// Notes' colour in Fusion's app rail (.am-app-ic.am-notes).
export const APP_COLOUR = '#A3E635';

// appColour gives an element the app's colour as Fusion's --am-cc, which its cards (the inset edge of .am-card) and
// the shared empty states (their icon) take.
export function appColour(): CSSProperties {
    return {'--am-cc': APP_COLOUR} as CSSProperties;
}
