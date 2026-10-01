// Copyright (c) 2026-present Antimatter contributors.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/model"

	"github.com/antimatterchat/antimatter-plugin-notes/server/relay"
)

// notePostType is the type of the posts sharing a note in its channel.
const notePostType = "custom_antimatter_note"

// maxShareMessageLength is the maximum length of the message posted with a shared note.
const maxShareMessageLength = 4000

// newRouter returns the router of the plugin's REST API, served under
// /plugins/com.antimatterchat.notes/api/v1.
func (p *Plugin) newRouter() *mux.Router {
	router := mux.NewRouter()
	router.Use(requireUser)

	api := router.PathPrefix("/api/v1").Subrouter()
	p.service.RegisterRoutes(api)
	api.HandleFunc("/docs/{doc_id:[a-z0-9]{26}}/share", p.handleShare).Methods(http.MethodPost)

	return router
}

func requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if relay.UserID(r) == "" {
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// escapeMarkdown keeps a title from being formatted in the message of a post.
func escapeMarkdown(s string) string {
	var b strings.Builder
	for _, r := range s {
		if strings.ContainsRune("\\`*_{}[]()#+-.!|<>~", r) {
			b.WriteRune('\\')
		}
		b.WriteRune(r)
	}
	return b.String()
}

// handleShare posts a card linking to a note in its channel.
func (p *Plugin) handleShare(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Message string `json:"message"`
	}
	if r.ContentLength != 0 {
		if err := relay.ReadJSON(w, r, maxShareMessageLength*4, &body); err != nil {
			p.service.WriteError(w, err)
			return
		}
	}
	message := strings.TrimSpace(body.Message)
	if len(message) > maxShareMessageLength {
		p.service.WriteError(w, relay.NewError(http.StatusBadRequest, "the message is too long"))
		return
	}

	doc, err := p.service.RequestDoc(r, false)
	if err != nil {
		p.service.WriteError(w, err)
		return
	}
	if doc.IsPersonal() {
		p.service.WriteError(w, relay.NewError(http.StatusBadRequest, "personal notes can't be shared"))
		return
	}

	userID := relay.UserID(r)
	if !p.API.HasPermissionToChannel(userID, doc.ChannelID, model.PermissionCreatePost) {
		p.service.WriteError(w, relay.NewError(http.StatusForbidden, "you can't post in this channel"))
		return
	}

	if message == "" {
		message = fmt.Sprintf("Shared a note: **%s**", escapeMarkdown(doc.Title))
	}
	post := &model.Post{
		UserId:    userID,
		ChannelId: doc.ChannelID,
		Message:   message,
		Type:      notePostType,
	}
	post.AddProp("doc_id", doc.ID)
	post.AddProp("title", doc.Title)

	created, appErr := p.API.CreatePost(post)
	if appErr != nil {
		p.service.WriteError(w, appErr)
		return
	}
	relay.WriteJSONStatus(w, http.StatusCreated, created)
}
