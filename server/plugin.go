// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

package main

import (
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"

	"github.com/antimatterchat/antimatter-plugin-notes/server/relay"
)

const (
	// Yjs updates of a few keystrokes are tens of bytes; pasted content can be large
	maxUpdateBytes    = 1024 * 1024
	maxSnapshotBytes  = 16 * 1024 * 1024
	maxAwarenessBytes = 4 * 1024

	// Clients merge the updates into a snapshot after this many updates or bytes
	compactAfterUpdates = 100
	compactAfterBytes   = 256 * 1024

	// Past snapshots kept as versions of a note
	keepVersions    = 20
	versionInterval = 10 * time.Minute

	// How long channel memberships are cached for the updates and cursor moves
	accessCacheTTL = 15 * time.Second
)

var (
	// A client sends at most one update at a time, batched every 50 ms, and its caret every
	// 100 ms: these leave room for a few open notes per user
	updateRateLimit    = relay.RateLimit{PerSecond: 20, Burst: 60}
	awarenessRateLimit = relay.RateLimit{PerSecond: 20, Burst: 40}
)

// Plugin implements the interface expected by the Antimatter server to communicate between the
// server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin

	// configurationLock synchronizes access to the configuration.
	configurationLock sync.RWMutex

	// configuration is the active plugin configuration. Consult getConfiguration and
	// setConfiguration for usage.
	configuration *configuration

	access  *relay.CachedAccess
	service *relay.Service
	router  *mux.Router
}

// OnActivate is invoked when the plugin is activated.
func (p *Plugin) OnActivate() error {
	var locker relay.Locker = relay.NewLocalLocker()
	if cfg := p.API.GetConfig(); cfg != nil && cfg.ClusterSettings.Enable != nil && *cfg.ClusterSettings.Enable {
		locker = relay.NewClusterLocker(p.API)
	}

	p.access = relay.NewCachedAccess(channelAccess{api: p.API}, accessCacheTTL)
	p.service = &relay.Service{
		Docs: relay.NewDocStore(p.API),
		Log: relay.NewLog(p.API, locker, relay.LogOptions{
			CompactAfterUpdates: compactAfterUpdates,
			CompactAfterBytes:   compactAfterBytes,
			KeepVersions:        keepVersions,
			VersionInterval:     versionInterval,
		}),
		Hub:                relay.NewHub(p.API),
		Access:             p.access,
		Logger:             p.API,
		DefaultTitle:       "Untitled note",
		MaxUpdateBytes:     maxUpdateBytes,
		MaxSnapshotBytes:   maxSnapshotBytes,
		MaxAwarenessBytes:  maxAwarenessBytes,
		UpdateRateLimit:    updateRateLimit,
		AwarenessRateLimit: awarenessRateLimit,
	}
	p.router = p.newRouter()
	return nil
}

// ServeHTTP serves the plugin's REST API.
func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.router.ServeHTTP(w, r)
}

// UserHasLeftChannel forgets the cached membership of users leaving (or removed from) a channel,
// so they stop receiving and making changes to its notes right away.
func (p *Plugin) UserHasLeftChannel(_ *plugin.Context, member *model.ChannelMember, _ *model.User) {
	if p.access != nil {
		p.access.Forget(member.UserId, member.ChannelId)
	}
}
