package handler

import (
	"github.com/gin-gonic/gin"

	"homeoa/internal/middleware"
	"homeoa/internal/service"
)

type AuthHandler struct {
	Users    *service.UserService
	JWT      *middleware.JWTManager
}

type loginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// Login 登录并签发 JWT。
func (h *AuthHandler) Login(c *gin.Context) {
	var in loginInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, 400, "BAD_REQUEST", "请求体不是合法 JSON")
		return
	}
	user, err := h.Users.Login(in.Username, in.Password)
	if err != nil {
		fail(c, 401, "LOGIN_FAILED", err.Error())
		return
	}
	token, err := h.JWT.Issue(user.ID, user.Username, user.Role, user.TokenVersion)
	if err != nil {
		fail(c, 500, "INTERNAL", "签发凭据失败")
		return
	}
	ok(c, gin.H{"token": token, "user": service.UserProfile{
		ID: user.ID, Username: user.Username, DisplayName: user.DisplayName,
		Email: user.Email, Role: user.Role, MailEnabled: user.MailEnabled,
	}})
}

func (h *AuthHandler) Me(c *gin.Context) {
	u := currentUser(c)
	ok(c, service.UserProfile{
		ID: u.ID, Username: u.Username, DisplayName: u.DisplayName,
		Email: u.Email, Role: u.Role, MailEnabled: u.MailEnabled,
	})
}

// UpdateMe 个人设置：姓名、邮箱、通知开关、改密码。
func (h *AuthHandler) UpdateMe(c *gin.Context) {
	var in service.UpdateMeInput
	if err := c.ShouldBindJSON(&in); err != nil {
		fail(c, 400, "BAD_REQUEST", "请求体不是合法 JSON")
		return
	}
	if err := h.Users.UpdateMe(currentUser(c), in); err != nil {
		serviceErr(c, err)
		return
	}
	u := currentUser(c)
	ok(c, service.UserProfile{
		ID: u.ID, Username: u.Username, DisplayName: u.DisplayName,
		Email: u.Email, Role: u.Role, MailEnabled: u.MailEnabled,
	})
}
