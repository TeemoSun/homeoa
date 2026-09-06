// Package handler 实现 HTTP 处理器。错误响应统一为 {code, message}。
package handler

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"homeoa/internal/middleware"
	"homeoa/internal/model"
	"homeoa/internal/service"
)

func ok(c *gin.Context, data any) {
	c.JSON(http.StatusOK, data)
}

func fail(c *gin.Context, status int, code, msg string) {
	c.JSON(status, gin.H{"code": code, "message": msg})
}

func serviceErr(c *gin.Context, err error) {
	var ierr *service.InternalError
	if errors.As(err, &ierr) {
		// 内部错误（数据库等）：细节只进日志，不回传客户端
		log.Printf("请求 %s %s 内部错误: %v", c.Request.Method, c.Request.URL.Path, err)
		fail(c, http.StatusInternalServerError, "INTERNAL", "服务器开小差了，请稍后再试")
		return
	}
	switch {
	case errors.Is(err, service.ErrNotFound):
		fail(c, http.StatusNotFound, "NOT_FOUND", "资源不存在")
	case errors.Is(err, service.ErrForbidden):
		fail(c, http.StatusForbidden, "FORBIDDEN", "没有权限执行该操作")
	default:
		// 其余为业务校验错误（如「用户名已存在」），文案可安全展示
		fail(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
	}
}

func currentUser(c *gin.Context) *model.User {
	return middleware.CurrentUser(c)
}

func pathID(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		fail(c, http.StatusBadRequest, "BAD_REQUEST", "路径参数 id 不正确")
		return 0, false
	}
	return uint(id), true
}

func pageParams(c *gin.Context) (page, pageSize int) {
	page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ = strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return
}

// isRecordNotFound 区分 GORM 查询空结果。
func isRecordNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
