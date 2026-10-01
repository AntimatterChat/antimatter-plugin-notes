// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/antimatterchat/antimatter-plugin-notes/server/relay"
	"github.com/antimatterchat/antimatter-plugin-notes/server/relay/relaytest"
)

// fakeChannels is a channelAPI with one channel and its members.
type fakeChannels struct {
	channel     *model.Channel
	members     map[string]bool
	permissions map[string]bool
}

func (f *fakeChannels) GetChannel(channelID string) (*model.Channel, *model.AppError) {
	if f.channel == nil || channelID != f.channel.Id {
		return nil, model.NewAppError("GetChannel", "not_found", nil, "", http.StatusNotFound)
	}
	return f.channel, nil
}

func (f *fakeChannels) GetChannelMember(channelID, userID string) (*model.ChannelMember, *model.AppError) {
	if f.channel == nil || channelID != f.channel.Id || !f.members[userID] {
		return nil, model.NewAppError("GetChannelMember", "not_found", nil, "", http.StatusNotFound)
	}
	return &model.ChannelMember{ChannelId: channelID, UserId: userID}, nil
}

func (f *fakeChannels) HasPermissionToChannel(userID, channelID string, permission *model.Permission) bool {
	return f.permissions[userID+"/"+permission.Id]
}

func TestChannelAccess(t *testing.T) {
	alice, bob := model.NewId(), model.NewId()
	channels := &fakeChannels{
		channel:     &model.Channel{Id: model.NewId(), Type: model.ChannelTypeOpen},
		members:     map[string]bool{alice: true},
		permissions: map[string]bool{alice + "/" + model.PermissionManagePublicChannelProperties.Id: true},
	}
	access := channelAccess{api: channels}

	p, err := access.ChannelPermission(alice, channels.channel.Id)
	require.NoError(t, err)
	assert.Equal(t, relay.ReadWrite, p)

	p, err = access.ChannelPermission(bob, channels.channel.Id)
	require.NoError(t, err)
	assert.Equal(t, relay.NoAccess, p)

	assert.True(t, access.CanManageChannel(alice, channels.channel.Id))
	assert.False(t, access.CanManageChannel(bob, channels.channel.Id))

	// Archived channels are read-only
	channels.channel.DeleteAt = 1
	p, err = access.ChannelPermission(alice, channels.channel.Id)
	require.NoError(t, err)
	assert.Equal(t, relay.ReadOnly, p)

	// Nobody manages direct messages
	channels.channel.Type = model.ChannelTypeDirect
	assert.False(t, access.CanManageChannel(alice, channels.channel.Id))
}

func TestEscapeMarkdown(t *testing.T) {
	assert.Equal(t, `Plan \*v2\* \[draft\]`, escapeMarkdown("Plan *v2* [draft]"))
}

func TestShare(t *testing.T) {
	alice := model.NewId()
	channels := &fakeChannels{
		channel: &model.Channel{Id: model.NewId(), Type: model.ChannelTypeOpen},
		members: map[string]bool{alice: true},
	}

	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	p := &Plugin{}
	p.SetAPI(api)
	kv := relaytest.NewKV()
	p.service = &relay.Service{
		Docs:             relay.NewDocStore(kv),
		Log:              relay.NewLog(kv, relay.NewLocalLocker(), relay.LogOptions{}),
		Hub:              relay.NewHub(&relaytest.Publisher{}),
		Access:           channelAccess{api: channels},
		MaxUpdateBytes:   1024,
		MaxSnapshotBytes: 1024,
	}
	p.router = p.newRouter()

	do := func(path string, body any) *httptest.ResponseRecorder {
		data, _ := json.Marshal(body)
		r := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(data))
		r.Header.Set("Mattermost-User-Id", alice)
		w := httptest.NewRecorder()
		p.ServeHTTP(nil, w, r)
		return w
	}

	w := do("/api/v1/docs", map[string]any{"title": "Plan *v2*", "channel_id": channels.channel.Id})
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	var doc relay.Doc
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &doc))

	api.On("HasPermissionToChannel", alice, channels.channel.Id, model.PermissionCreatePost).Return(true)
	api.On("CreatePost", mock.MatchedBy(func(post *model.Post) bool {
		return post.UserId == alice && post.ChannelId == channels.channel.Id && post.Type == notePostType &&
			post.Message == `Shared a note: **Plan \*v2\***` && post.GetProp("doc_id") == doc.ID
	})).Return(&model.Post{Id: model.NewId()}, nil)

	w = do("/api/v1/docs/"+doc.ID+"/share", map[string]any{})
	assert.Equal(t, http.StatusCreated, w.Code, w.Body.String())

	// Personal notes can't be shared
	w = do("/api/v1/docs", map[string]any{"title": "Mine"})
	require.Equal(t, http.StatusCreated, w.Code)
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &doc))
	w = do("/api/v1/docs/"+doc.ID+"/share", map[string]any{})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}
