// Package config 负责从环境变量读取应用配置。
// 敏感配置（JWT_SECRET、数据库密码、管理员初始密码、SMTP 凭据）不提供任何默认值，
// 缺失时启动报错，避免硬编码凭据进入代码仓库。
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	AppPort string
	Env     string // production / development
	TZ      string

	JWTSecret      string
	JWTExpireHours time.Duration

	AdminInitialPassword string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string
	MailEnabled  bool
}

func require(key string) (string, error) {
	v := os.Getenv(key)
	if v == "" {
		return "", fmt.Errorf("缺少必需的环境变量 %s", key)
	}
	return v, nil
}

func get(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// Load 读取全部环境变量并校验必填项。
func Load() (*Config, error) {
	cfg := &Config{
		AppPort: get("APP_PORT", "8080"),
		Env:     get("APP_ENV", "production"),
		TZ:      get("TZ", "Asia/Shanghai"),

		DBHost: get("DB_HOST", "127.0.0.1"),
		DBPort: get("DB_PORT", "5432"),
		DBUser: get("DB_USER", "homeoa"),
		DBName: get("DB_NAME", "homeoa"),
	}

	var err error
	for key, dst := range map[string]*string{
		"JWT_SECRET":              &cfg.JWTSecret,
		"ADMIN_INITIAL_PASSWORD":  &cfg.AdminInitialPassword,
		"DB_PASSWORD":             &cfg.DBPassword,
	} {
		if *dst, err = require(key); err != nil {
			return nil, err
		}
	}

	hours, err := strconv.Atoi(get("JWT_EXPIRE_HOURS", "24"))
	if err != nil || hours <= 0 {
		return nil, errors.New("JWT_EXPIRE_HOURS 必须为正整数")
	}
	cfg.JWTExpireHours = time.Duration(hours) * time.Hour

	if len(cfg.JWTSecret) < 32 {
		return nil, errors.New("JWT_SECRET 长度不能少于 32 个字符")
	}

	cfg.SMTPHost = get("SMTP_HOST", "")
	cfg.SMTPUser = get("SMTP_USER", "")
	cfg.SMTPPassword = get("SMTP_PASSWORD", "")
	port, err := strconv.Atoi(get("SMTP_PORT", "465"))
	if err != nil || port <= 0 {
		return nil, errors.New("SMTP_PORT 必须为正整数")
	}
	cfg.SMTPPort = port

	cfg.MailEnabled = get("MAIL_ENABLED", "false") == "true"
	if cfg.MailEnabled && (cfg.SMTPHost == "" || cfg.SMTPUser == "" || cfg.SMTPPassword == "") {
		return nil, errors.New("MAIL_ENABLED=true 时必须完整配置 SMTP_HOST / SMTP_USER / SMTP_PASSWORD")
	}

	return cfg, nil
}
