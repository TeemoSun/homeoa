// Package router 注册 API 路由与嵌入的前端静态资源（SPA fallback）。
package router

import (
	"io/fs"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"homeoa/internal/config"
	"homeoa/internal/handler"
	"homeoa/internal/mailer"
	"homeoa/internal/middleware"
	"homeoa/internal/model"
	"homeoa/internal/service"
	"homeoa/internal/web"
)

func New(cfg *config.Config, db *gorm.DB) (*gin.Engine, *mailer.Mailer, error) {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	// 应用直接面向公网，不信任代理头，避免伪造 X-Forwarded-For 绕过限流
	if err := r.SetTrustedProxies(nil); err != nil {
		return nil, nil, err
	}
	r.Use(middleware.SecureHeaders(), middleware.MaxBody(1<<20), gin.Recovery())

	jwtMgr := middleware.NewJWTManager([]byte(cfg.JWTSecret), cfg.JWTExpireHours)
	mailClient := mailer.New(cfg, db)
	userSvc := &service.UserService{DB: db}
	typeSvc := &service.RequestTypeService{DB: db}
	reqSvc := &service.RequestService{DB: db, Mailer: mailClient}
	authH := &handler.AuthHandler{Users: userSvc, JWT: jwtMgr}
	userH := &handler.UserHandler{Users: userSvc}
	typeH := &handler.RequestTypeHandler{Types: typeSvc}
	reqH := &handler.RequestHandler{Requests: reqSvc}
	dashH := &handler.DashboardHandler{
		Dashboard: &service.DashboardService{DB: db},
		MailLog:   &service.MailLogService{DB: db},
	}

	r.GET("/api/health", handler.Health(db))

	v1 := r.Group("/api/v1")
	v1.POST("/auth/login", middleware.LoginRateLimit(middleware.NewLoginLimiter(20, 5*time.Minute)), authH.Login)

	authed := v1.Group("", middleware.Auth(jwtMgr, db))
	{
		authed.GET("/auth/me", authH.Me)
		authed.PUT("/users/me", authH.UpdateMe)

		authed.GET("/dashboard/stats", dashH.Stats)

		authed.GET("/users", middleware.Admin(), userH.List)
		authed.POST("/users", middleware.Admin(), userH.Create)
		authed.PUT("/users/:id", middleware.Admin(), userH.Update)
		authed.DELETE("/users/:id", middleware.Admin(), userH.Delete)

		authed.GET("/request-types", typeH.List)
		authed.POST("/request-types", middleware.Admin(), typeH.Create)
		authed.PUT("/request-types/:id", middleware.Admin(), typeH.Update)
		authed.DELETE("/request-types/:id", middleware.Admin(), typeH.Delete)

		authed.POST("/requests", reqH.Create)
		authed.GET("/requests", reqH.List)
		authed.GET("/requests/:id", reqH.Detail)
		authed.POST("/requests/:id/approve", reqH.Decide(model.ActionApprove))
		authed.POST("/requests/:id/reject", reqH.Decide(model.ActionReject))
		authed.POST("/requests/:id/return", reqH.Decide(model.ActionReturn))
		authed.POST("/requests/:id/withdraw", reqH.Withdraw)
		authed.POST("/requests/:id/comment", reqH.Comment)
		authed.POST("/requests/:id/resubmit", reqH.Resubmit)

		authed.GET("/mail-logs", middleware.Admin(), dashH.MailLogs)
	}

	// 前端静态资源 + SPA fallback：非 /api 路径一律回退到 index.html
	dist, err := web.Dist()
	if err != nil {
		return nil, nil, err
	}
	fileServer := http.FileServer(http.FS(dist))
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api/") || path == "/api" {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "接口不存在"})
			return
		}
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.JSON(http.StatusMethodNotAllowed, gin.H{"code": "METHOD_NOT_ALLOWED", "message": "不支持的请求方法"})
			return
		}
		name := strings.TrimPrefix(path, "/")
		if name == "" {
			name = "index.html"
		}
		if _, err := fs.Stat(dist, name); err != nil || strings.HasSuffix(name, "/") {
			// 未知路径回退到 SPA 入口，必须重置 name 为 index.html
			name = "index.html"
			c.Request.URL.Path = "/"
		}
		if name == "index.html" {
			index, rerr := fs.ReadFile(dist, "index.html")
			if rerr != nil {
				c.String(http.StatusNotFound, "前端资源缺失")
				return
			}
			c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
			c.Data(http.StatusOK, "text/html; charset=utf-8", index)
			return
		}
		// 带 hash 的静态资源可以长缓存，非 hash 根文件短期缓存
		if strings.HasPrefix(name, "assets/") {
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			c.Header("Cache-Control", "public, max-age=86400")
		}
		fileServer.ServeHTTP(c.Writer, c.Request)
	})
	return r, mailClient, nil
}
