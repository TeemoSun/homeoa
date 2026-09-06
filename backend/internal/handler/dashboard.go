package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"homeoa/internal/service"
)

type DashboardHandler struct {
	Dashboard *service.DashboardService
	MailLog   *service.MailLogService
}

func (h *DashboardHandler) Stats(c *gin.Context) {
	stats, err := h.Dashboard.Stats(currentUser(c))
	if err != nil {
		fail(c, 500, "INTERNAL", "统计查询失败")
		return
	}
	ok(c, stats)
}

func (h *DashboardHandler) MailLogs(c *gin.Context) {
	page, pageSize := pageParams(c)
	list, total, err := h.MailLog.List(page, pageSize)
	if err != nil {
		fail(c, 500, "INTERNAL", "查询邮件日志失败")
		return
	}
	ok(c, gin.H{"list": list, "total": total, "page": page, "page_size": pageSize})
}

// Health 健康检查（公开，供容器 HEALTHCHECK 使用）。
func Health(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		dbStatus := "up"
		if sqlDB, err := db.DB(); err != nil || sqlDB.Ping() != nil {
			dbStatus = "down"
		}
		status := http.StatusOK
		if dbStatus == "down" {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, gin.H{"status": "ok", "db": dbStatus})
	}
}
