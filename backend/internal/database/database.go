// Package database 负责 PostgreSQL 连接、自动迁移与种子数据。
package database

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"homeoa/internal/config"
	"homeoa/internal/model"
)

// Open 连接 PostgreSQL；容器编排下 PostgreSQL 可能晚于应用就绪，做有限次重试。
func Open(cfg *config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=%s",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort, cfg.TZ)

	var db *gorm.DB
	var err error
	for attempt := 1; attempt <= 30; attempt++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Warn),
		})
		if err == nil {
			sqlDB, pingErr := db.DB()
			if pingErr == nil && sqlDB.Ping() == nil {
				sqlDB.SetMaxOpenConns(25)
				sqlDB.SetMaxIdleConns(10)
				sqlDB.SetConnMaxLifetime(10 * time.Minute)
				sqlDB.SetConnMaxIdleTime(5 * time.Minute)
				return db, nil
			}
		}
		if attempt == 1 {
			log.Printf("数据库暂不可用，开始重试: %v", err)
		}
		time.Sleep(2 * time.Second)
	}
	return nil, fmt.Errorf("连接数据库失败（已重试 30 次）: %w", err)
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.User{},
		&model.RequestType{},
		&model.Request{},
		&model.RequestLog{},
		&model.MailLog{},
	)
}

// Seed 写入内置类型（仅预算申请）与首个管理员账号，幂等。
// 全部种子数据均为虚构内容。
func Seed(db *gorm.DB, adminPassword string) error {
	var adminCount int64
	if err := db.Model(&model.User{}).Where("role = ?", model.RoleAdmin).Count(&adminCount).Error; err != nil {
		return err
	}
	if adminCount == 0 {
		hash, err := HashPassword(adminPassword)
		if err != nil {
			return fmt.Errorf("生成管理员密码哈希失败: %w", err)
		}
		admin := model.User{
			Username:     "admin",
			PasswordHash: hash,
			DisplayName:  "管理员",
			Role:         model.RoleAdmin,
			MailEnabled:  true,
		}
		if err := db.Create(&admin).Error; err != nil {
			return fmt.Errorf("创建初始管理员失败: %w", err)
		}
		log.Printf("已创建初始管理员账号 admin（密码来自 ADMIN_INITIAL_PASSWORD）")
	}

	var typeCount int64
	if err := db.Model(&model.RequestType{}).Where("code = ?", "purchase").Count(&typeCount).Error; err != nil {
		return err
	}
	if typeCount == 0 {
		purchase := model.RequestType{
			Code:    "purchase",
			Name:    "预算申请",
			Icon:    "IconHistogram",
			Enabled: true,
			FormSchema: model.JSON(`{"fields":[
{"name":"item_name","label":"物品名称","type":"text","required":true,"placeholder":"想买什么"},
{"name":"amount","label":"预估金额（元）","type":"number","required":true,"placeholder":"0.00"},
{"name":"reason","label":"购买理由","type":"textarea","required":true,"placeholder":"为什么要买"},
{"name":"link","label":"商品链接","type":"text","required":false,"placeholder":"选填"},
{"name":"expected_date","label":"期望到位时间","type":"date","required":false}
]}`),
		}
		if err := db.Create(&purchase).Error; err != nil {
			return fmt.Errorf("创建内置预算申请类型失败: %w", err)
		}
		log.Printf("已创建内置请求类型：预算申请（购买）")
	}
	return nil
}
