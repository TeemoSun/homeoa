// Package service 实现业务逻辑。全部数据访问经 GORM 参数绑定，外部输入不拼接 SQL。
package service

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

var (
	usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_]{2,32}$`)
	codeRe     = regexp.MustCompile(`^[a-z0-9_-]{2,32}$`)
	emailRe    = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
)

var (
	ErrBadRequest = errors.New("请求参数不合法")
	ErrNotFound   = errors.New("资源不存在")
	ErrForbidden  = errors.New("没有权限执行该操作")
)

// InternalError 标记来自内部组件（数据库等）的错误：处理器对它只回通用文案。
type InternalError struct{ Err error }

func (e *InternalError) Error() string { return e.Err.Error() }
func (e *InternalError) Unwrap() error { return e.Err }

// Internal 包装内部组件错误。
func Internal(err error) error { return &InternalError{Err: err} }

func validateUsername(name string) error {
	if !usernameRe.MatchString(name) {
		return errors.New("用户名只能包含字母、数字、下划线，长度 2-32 位")
	}
	return nil
}

func validateEmail(email string) error {
	if email != "" && (!emailRe.MatchString(email) || utf8.RuneCountInString(email) > 128) {
		return errors.New("邮箱格式不正确")
	}
	return nil
}

func validatePassword(pwd string) error {
	if len(pwd) < 8 || len(pwd) > 64 {
		return errors.New("密码长度需在 8-64 位之间")
	}
	return nil
}

func trimString(s string, max int) string {
	s = strings.TrimSpace(s)
	if utf8.RuneCountInString(s) > max {
		runes := []rune(s)
		return string(runes[:max])
	}
	return s
}
