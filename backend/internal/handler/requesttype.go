package handler

import (
	"github.com/gin-gonic/gin"

	"homeoa/internal/service"
)

type RequestTypeHandler struct {
	Types *service.RequestTypeService
}

func (h *RequestTypeHandler) List(c *gin.Context) {
	types, err := h.Types.List(currentUser(c))
	if err != nil {
		fail(c, 500, "INTERNAL", "查询请求类型失败")
		return
	}
	ok(c, gin.H{"list": types})
}

func (h *RequestTypeHandler) Create(c *gin.Context) {
	var in service.SaveTypeInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, 400, "BAD_REQUEST", "请求体不是合法 JSON")
		return
	}
	t, err := h.Types.Create(in)
	if err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, t)
}

func (h *RequestTypeHandler) Update(c *gin.Context) {
	id, valid := pathID(c)
	if !valid {
		return
	}
	var in service.SaveTypeInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, 400, "BAD_REQUEST", "请求体不是合法 JSON")
		return
	}
	t, err := h.Types.Update(id, in)
	if err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, t)
}

func (h *RequestTypeHandler) Delete(c *gin.Context) {
	id, valid := pathID(c)
	if !valid {
		return
	}
	if err := h.Types.Delete(id); err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, gin.H{"deleted": true})
}
