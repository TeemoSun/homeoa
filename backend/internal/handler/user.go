package handler

import (
	"github.com/gin-gonic/gin"

	"homeoa/internal/service"
)

type UserHandler struct {
	Users *service.UserService
}

func (h *UserHandler) List(c *gin.Context) {
	users, err := h.Users.List()
	if err != nil {
		fail(c, 500, "INTERNAL", "查询成员失败")
		return
	}
	ok(c, gin.H{"list": users})
}

func (h *UserHandler) Create(c *gin.Context) {
	var in service.CreateUserInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, 400, "BAD_REQUEST", "请求体不是合法 JSON")
		return
	}
	user, err := h.Users.Create(in)
	if err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, user)
}

func (h *UserHandler) Update(c *gin.Context) {
	id, valid := pathID(c)
	if !valid {
		return
	}
	var in service.UpdateUserInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, 400, "BAD_REQUEST", "请求体不是合法 JSON")
		return
	}
	user, err := h.Users.Update(currentUser(c), id, in)
	if err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, user)
}

func (h *UserHandler) Delete(c *gin.Context) {
	id, valid := pathID(c)
	if !valid {
		return
	}
	if err := h.Users.Delete(currentUser(c), id); err != nil {
		serviceErr(c, err)
		return
	}
	ok(c, gin.H{"deleted": true})
}
