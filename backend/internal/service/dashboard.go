package service

import (
	"time"

	"gorm.io/gorm"

	"homeoa/internal/model"
)

type DashboardService struct {
	DB *gorm.DB
}

type DashboardStats struct {
	TodoCount      int64             `json:"todo_count"`
	TodoList       []model.Request   `json:"todo_list"`
	StatusCount    map[string]int64  `json:"status_count"`
	MonthSubmitted int64             `json:"month_submitted"`
	MonthAmount    float64           `json:"month_amount"`
}

// Stats：status_count 按视角统计（管理员看全部，成员看自己的）；
// todo_list 为待该用户审批的申请。
func (s *DashboardService) Stats(user *model.User) (*DashboardStats, error) {
	stats := &DashboardStats{StatusCount: map[string]int64{}}

	base := s.DB.Model(&model.Request{})
	if user.Role != model.RoleAdmin {
		base = base.Where("submitter_id = ?", user.ID)
	}
	for _, st := range []string{model.StatusPending, model.StatusApproved, model.StatusRejected, model.StatusReturned, model.StatusWithdrawn} {
		var n int64
		if err := base.Session(&gorm.Session{}).Where("status = ?", st).Count(&n).Error; err != nil {
			return nil, err
		}
		stats.StatusCount[st] = n
	}

	monthStart := time.Now().AddDate(0, 0, 1-time.Now().Day())
	monthStart = time.Date(monthStart.Year(), monthStart.Month(), monthStart.Day(), 0, 0, 0, 0, time.Local)
	if err := base.Session(&gorm.Session{}).Where("created_at >= ?", monthStart).Count(&stats.MonthSubmitted).Error; err != nil {
		return nil, err
	}

	// 本月发起的金额合计（有金额字段的类型）
	type amountSum struct{ Total *float64 }
	var sum amountSum
	if err := base.Session(&gorm.Session{}).Select("COALESCE(SUM(amount), 0) AS total").
		Where("created_at >= ? AND amount IS NOT NULL", monthStart).Scan(&sum).Error; err == nil && sum.Total != nil {
		stats.MonthAmount = *sum.Total
	}

	// 待办：管理员 = 全部待审批；成员 = 自己担任类型审批人的待审批
	todo := s.DB.Model(&model.Request{}).Where("status = ?", model.StatusPending)
	if user.Role != model.RoleAdmin {
		todo = todo.Joins("JOIN request_types ON request_types.id = requests.type_id").
			Where("request_types.approver_id = ?", user.ID)
	}
	if err := todo.Session(&gorm.Session{}).Count(&stats.TodoCount).Error; err != nil {
		return nil, err
	}
	err := todo.Session(&gorm.Session{}).
		Preload("Type", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, code, name, icon")
		}).Preload("Submitter", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, username, display_name")
		}).Order("created_at asc").Limit(10).Find(&stats.TodoList).Error
	return stats, err
}

type MailLogService struct {
	DB *gorm.DB
}

func (s *MailLogService) List(page, pageSize int) ([]model.MailLog, int64, error) {
	q := s.DB.Model(&model.MailLog{})
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	var list []model.MailLog
	err := q.Order("created_at desc, id desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}
