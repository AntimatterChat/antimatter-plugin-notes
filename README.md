# Notes

An Antimatter plugin for real-time collaborative notes: rich text documents shared with a channel
or kept personal, edited by several people at once, with everyone's caret visible.

## Features

- **Notes app.** The Notes icon of the app bar (a channel header button on servers without the app
  bar) opens a panel listing the notes shared with the current channel and your personal notes.
- **Channel and personal notes.** Every member of a channel can read and edit its notes; they
  become read-only when the channel is archived. Personal notes are only visible to you. Notes are
  deleted by their creator or by the channel admins.
- **Live editing.** Rich text (headings, bold, italic, strikethrough, lists, checklists, quotes,
  code, links) with the carets, selections and names of the other editors, who's editing, and the
  save status. Changes made offline are sent when the connection is back.
- **History.** A version of each note is kept every 10 minutes or so while it's edited (the last
  20): preview and restore them from **Version history** (restoring is an edit, it can be undone).
- **Export to Markdown**, and **Share in the channel**, which posts a card that opens the note.
- **Both web UIs.** Under the Fusion web UI the panel is drawn with the mockup's markup and
  Fusion's styles; the classic UI gets a classic-styled version.

## How it works

Notes are [Yjs](https://github.com/yjs/yjs) documents edited with [Tiptap](https://tiptap.dev)
(both MIT). The server doesn't parse them: it keeps an append-only log of the Yjs updates of each
note in the plugin KV store and relays them, and the presence of the editors (Yjs awareness), to
the members of the note's channel (or to its owner) with websocket events. Clients post their
updates over HTTP, catch up on the ones they missed after a reconnection, and post a snapshot of
the whole note when the server asks (every 100 updates or 256 KiB), which replaces the updates it
covers. Each user can send twenty updates and twenty caret moves a second on average (in bursts
of 60 and 40), per server; beyond that the relay answers 429 and clients send the update again a
moment later.

The relay is shared with the whiteboard plugin: `server/relay` and `webapp/src/relay` are copied in
both repositories and must be kept in sync.

REST API, under `/plugins/com.antimatterchat.notes/api/v1` (the user is the one of the session):

| Method and path | |
| --- | --- |
| `GET /docs?channel_id=` | the notes of a channel, or your personal notes without `channel_id` |
| `POST /docs` | create a note: `{"title", "channel_id"}` (no channel: personal) |
| `GET`, `PATCH`, `DELETE /docs/{id}` | a note, rename it (`{"title"}`), delete it |
| `GET /docs/{id}/state` | the snapshot and the updates after it (base64) |
| `GET /docs/{id}/updates?after=` | the updates after a sequence number, or `reset` |
| `POST /docs/{id}/updates` | add an update: `{"client_id", "data"}` |
| `PUT /docs/{id}/snapshot` | compact: `{"seq", "data"}` |
| `POST /docs/{id}/awareness` | relay the presence of an editor |
| `GET /docs/{id}/versions[/{seq}]` | the kept versions |
| `POST /docs/{id}/share` | post a card linking to the note in its channel |

Websocket events: `custom_com.antimatterchat.notes_` + `update`, `awareness`, `doc_reset`,
`doc_created`, `doc_updated`, `doc_deleted`.

## Trying it with two users

With `run-local.sh` (`PLUGINS="notes" ./run-local.sh plugins`, then `run`), log in as alice in one
browser and bob in another (or a private window), open the same channel, click the Notes icon of
the app bar, create a note in the channel as alice and open it as bob: what one types appears for
the other, with their caret. Reload a window: the note is still there.

## Development

```sh
make dist      # build the plugin bundle in dist/
make test      # run the server and webapp tests
make check-style
```

Set `MM_SERVICESETTINGS_ENABLEDEVELOPER=true` to only build the server for the current platform.

## License

GNU Affero General Public License v3.0, see [LICENSE.txt](LICENSE.txt). The build tooling is derived
from Apache-2.0 licensed Mattermost plugins, see [NOTICE.txt](NOTICE.txt).
