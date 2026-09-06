// Package model 定义 GORM 数据模型。所有查询经由 GORM 参数绑定，避免 SQL 注入。
package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// ---- JSON 列类型：MySQL 用 JSON，SQLite（测试）用 TEXT ----

type JSON json.RawMessage

func (j JSON) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return string(j), nil
}

func (j *JSON) Scan(v any) error {
	if v == nil {
		*j = nil
		return nil
	}
	var b []byte
	switch data := v.(type) {
	case []byte:
		b = data
	case string:
		b = []byte(data)
	default:
		return errors.New("JSON 列扫描失败：不支持的底层类型")
	}
	if len(b) == 0 {
		*j = nil
		return nil
	}
	out := make(JSON, len(b))
	copy(out, b)
	*j = out
	return nil
}

func (j JSON) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

func (j *JSON) UnmarshalJSON(b []byte) error {
	if string(b) == "null" {
		*j = nil
		return nil
	}
	out := make(JSON, len(b))
	copy(out, b)
	*j = out
	return nil
}

func (JSON) GormDBDataType(db *gorm.DB, _ *schema.Field) string {
	if db.Dialector.Name() == "mysql" {
		return "JSON"
	}
	return "TEXT"
}

// GormDataType 供 GORM 关系推断使用。
func (JSON) GormDataType() string { return "json" }

// ---- 用户 ----

const (
	RoleAdmin  = "admin"
	RoleMember = "member"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"size:64;uniqueIndex;not null" json:"username"`
	PasswordHash string    `gorm:"size:128;not null" json:"-"`
	DisplayName  string    `gorm:"size:64;not null" json:"display_name"`
	Email        string    `gorm:"size:128;index" json:"email"`
	Role         string    `gorm:"size:16;not null;default:member;index" json:"role"`
	MailEnabled  bool      `gorm:"not null;default:true" json:"mail_enabled"`
	TokenVersion int       `gorm:"not null;default:0" json:"-"` // 改密时递增，使已签发的凭据全部失效
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ---- 请求类型（数据驱动，动态表单 Schema）----

type FormField struct {
	Name        string `json:"name"`
	Label       string `json:"label"`
	Type        string `json:"type"` // text / textarea / number / date
	Required    bool   `json:"required"`
	Placeholder string `json:"placeholder,omitempty"`
}

type FormSchema struct {
	Fields []FormField `json:"fields"`
}

type RequestType struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Code       string    `gorm:"size:32;uniqueIndex;not null" json:"code"`
	Name       string    `gorm:"size:64;not null" json:"name"`
	Icon       string    `gorm:"size:32" json:"icon"`
	FormSchema JSON      `gorm:"column:form_schema" json:"form_schema"`
	ApproverID *uint     `gorm:"index" json:"approver_id"` // 空 = 全部管理员审批
	Approver   *User     `gorm:"foreignKey:ApproverID" json:"approver,omitempty"`
	Enabled    bool      `gorm:"not null;default:true" json:"enabled"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// ---- 审批单 ----

const (
	StatusPending   = "pending"
	StatusApproved  = "approved"
	StatusRejected  = "rejected"
	StatusReturned  = "returned"
	StatusWithdrawn = "withdrawn"
)

type Request struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	TypeID     uint       `gorm:"not null;index" json:"type_id"`
	Type       *RequestType `gorm:"foreignKey:TypeID" json:"type,omitempty"`
	Title      string     `gorm:"size:128;not null" json:"title"`
	Amount     *float64   `gorm:"column:amount;type:decimal(12,2)" json:"amount"` // Schema 中 name=amount 的数值字段自动同步
	FormData   JSON       `gorm:"column:form_data" json:"form_data"`
	Status     string     `gorm:"size:16;not null;default:pending;index" json:"status"`
	SubmitterID uint      `gorm:"not null;index" json:"submitter_id"`
	Submitter  *User      `gorm:"foreignKey:SubmitterID" json:"submitter,omitempty"`
	ApproverID *uint      `json:"approver_id"` // 实际做出决定的人
	Approver   *User      `gorm:"foreignKey:ApproverID" json:"approver,omitempty"`
	DecisionComment string    `gorm:"size:512" json:"decision_comment"`
	DecidedAt       *time.Time `json:"decided_at"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ---- 流转记录 ----

const (
	ActionSubmit   = "submit"
	ActionResubmit = "resubmit"
	ActionApprove  = "approve"
	ActionReject   = "reject"
	ActionReturn   = "return"
	ActionWithdraw = "withdraw"
	ActionComment  = "comment"
)

type RequestLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	RequestID uint      `gorm:"not null;index" json:"request_id"`
	ActorID   uint      `gorm:"not null;index" json:"actor_id"`
	Actor     *User     `gorm:"foreignKey:ActorID" json:"actor,omitempty"`
	Action    string    `gorm:"size:16;not null" json:"action"`
	Comment   string    `gorm:"size:512" json:"comment"`
	CreatedAt time.Time `json:"created_at"`
}

// ---- 邮件发送日志 ----

const (
	MailSent    = "sent"
	MailFailed  = "failed"
	MailSkipped = "skipped"
)

type MailLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	RequestID *uint     `gorm:"index" json:"request_id"`
	ToEmail   string    `gorm:"size:128;not null" json:"to_email"`
	Subject   string    `gorm:"size:256" json:"subject"`
	Status    string    `gorm:"size:16;not null" json:"status"`
	Error     string    `gorm:"size:512" json:"error"`
	CreatedAt time.Time `json:"created_at"`
}

// ParseFormSchema 解析类型的动态表单 Schema。
func ParseFormSchema(raw JSON) (*FormSchema, error) {
	if len(raw) == 0 {
		return nil, errors.New("表单 Schema 为空")
	}
	var s FormSchema
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, fmt.Errorf("表单 Schema 不是合法 JSON: %w", err)
	}
	if len(s.Fields) == 0 {
		return nil, errors.New("表单 Schema 至少需要一个字段")
	}
	seen := map[string]bool{}
	for _, f := range s.Fields {
		if f.Name == "" || f.Label == "" {
			return nil, errors.New("表单字段的 name 与 label 不能为空")
		}
		switch f.Type {
		case "text", "textarea", "number", "date":
		default:
			return nil, fmt.Errorf("不支持的字段类型 %q（可选 text/textarea/number/date）", f.Type)
		}
		if seen[f.Name] {
			return nil, fmt.Errorf("字段名 %q 重复", f.Name)
		}
		seen[f.Name] = true
	}
	return &s, nil
}
