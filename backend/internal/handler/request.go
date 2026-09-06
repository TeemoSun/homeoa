package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"homeoa/internal/service"
)

type RequestHandler struct {
	Requests *service.RequestService
}

func (h *RequestHandler) Create(c *gin.Context) {
	var in service.CreateRequestInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, 400, "BAD_REQUEST", "请求体不是合法 JSON")
		return
	}
	req, err := h.Requests.Create(currentUser(c), in)
	if err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, req)
}

func (h *RequestHandler) List(c *gin.Context) {
	scope := c.DefaultQuery("scope", "mine")
	status := c.Query("status")
	typeID, _ := strconv.ParseUint(c.Query("type_id"), 10, 64)
	page, pageSize := pageParams(c)
	list, total, err := h.Requests.List(currentUser(c), scope, status, uint(typeID), page, pageSize)
	if err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, gin.H{"list": list, "total": total, "page": page, "page_size": pageSize})
}

func (h *RequestHandler) Detail(c *gin.Context) {
	id, valid := pathID(c)
	if !valid {
		return
	}
	req, logs, err := h.Requests.Get(currentUser(c), id)
	if err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, gin.H{"request": req, "logs": logs})
}

func (h *RequestHandler) Decide(action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, valid := pathID(c)
		if !valid {
			return
		}
		var in service.DecisionInput
		if err := c.ShouldBindJSON(&in); err != nil && err.Error() != "EOF" {
			fail(c, 400, "BAD_REQUEST", "请求体不是合法 JSON")
			return
		}
		req, err := h.Requests.Decide(currentUser(c), id, action, in.Comment)
		if err != nil {
			serviceErr(c, err)
			return
		}
		ok(c, req)
	}
}

func (h *RequestHandler) Withdraw(c *gin.Context) {
	id, valid := pathID(c)
	if !valid {
		return
	}
	if err := h.Requests.Withdraw(currentUser(c), id); err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, gin.H{"withdrawn": true})
}

func (h *RequestHandler) Comment(c *gin.Context) {
	id, valid := pathID(c)
	if !valid {
		return
	}
	var in service.DecisionInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, 400, "BAD_REQUEST", "请求体不是合法 JSON")
		return
	}
	entry, err := h.Requests.Comment(currentUser(c), id, in.Comment)
	if err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, entry)
}

// Resubmit 退回后修改并重新提交。
func (h *RequestHandler) Resubmit(c *gin.Context) {
	id, valid := pathID(c)
	if !valid {
		return
	}
	var in service.CreateRequestInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, 400, "BAD_REQUEST", "请求体不是合法 JSON")
		return
	}
	req, err := h.Requests.Resubmit(currentUser(c), id, in)
	if err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, req)
}
