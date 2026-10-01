// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

// mentionUsername returns the username of a mention, keeping the characters usernames have.
export function mentionUsername(label: unknown): string {
    return String(label ?? '').replace(/[^A-Za-z0-9._-]/g, '');
}
