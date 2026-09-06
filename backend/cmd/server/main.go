// HomeOA 家庭 OA 审批系统后端入口。
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "time/tzdata" // 保证无系统 tzdata 的容器内时区可用

	"homeoa/internal/config"
	"homeoa/internal/database"
	"homeoa/internal/router"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("配置加载失败: %v", err)
	}
	if _, err := time.LoadLocation(cfg.TZ); err != nil {
		log.Printf("时区 %s 不可用，使用系统默认: %v", cfg.TZ, err)
	}

	db, err := database.Open(cfg)
	if err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}
	if err := database.Seed(db, cfg.AdminInitialPassword); err != nil {
		log.Fatalf("种子数据写入失败: %v", err)
	}

	r, err := router.New(cfg, db)
	if err != nil {
		log.Fatalf("路由初始化失败: %v", err)
	}

	srv := &http.Server{
		Addr:              ":" + cfg.AppPort,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Printf("HomeOA 启动于 :%s（环境 %s，邮件 %s）",
			cfg.AppPort, cfg.Env, map[bool]string{true: "已启用", false: "未启用"}[cfg.MailEnabled])
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("HTTP 服务异常退出: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("收到退出信号，正在关闭……")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("优雅关闭失败: %v", err)
	}
}
