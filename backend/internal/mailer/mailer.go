// Package mailer 封装 SMTP 发信：异步发送、失败重试一次、落库邮件日志。
// 收件人只来自用户资料里的邮箱字段；未配置邮箱的用户跳过发送并记日志。
package mailer

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/wneessen/go-mail"
	"gorm.io/gorm"

	"homeoa/internal/config"
	"homeoa/internal/model"
)

type Mailer struct {
	cfg *config.Config
	db  *gorm.DB
	wg  sync.WaitGroup
}

func New(cfg *config.Config, db *gorm.DB) *Mailer {
	return &Mailer{cfg: cfg, db: db}
}

// Close 等待所有在途邮件发送完成或上下文超时。
func (m *Mailer) Close(ctx context.Context) error {
	if m == nil {
		return nil
	}
	done := make(chan struct{})
	go func() {
		m.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// sendSem 限制同时发送的邮件 goroutine 数量，防止高频事件耗尽 SMTP 配额。
var sendSem = make(chan struct{}, 4)

// SendAsync 向单个收件人异步发送，失败后重试一次，结果写入 mail_logs。
// 不阻塞 API 响应；发送失败只记日志，不影响业务。未启用邮件时直接退出。
func (m *Mailer) SendAsync(requestID *uint, toEmail, subject, htmlBody string) {
	if m == nil || !m.cfg.MailEnabled {
		return
	}
	m.wg.Add(1)
	go func() {
		defer m.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("邮件 goroutine panic: %v", r)
			}
		}()
		sendSem <- struct{}{}
		defer func() { <-sendSem }()
		err := m.send(toEmail, subject, htmlBody)
		status, errMsg := model.MailSent, ""
		if err != nil {
			// 重试一次
			time.Sleep(2 * time.Second)
			if retryErr := m.send(toEmail, subject, htmlBody); retryErr != nil {
				status, errMsg = model.MailFailed, retryErr.Error()
			}
		}
		if status == model.MailSent {
			log.Printf("邮件已发送: to=%s subject=%s", toEmail, subject)
		} else {
			log.Printf("邮件发送失败: to=%s subject=%s err=%s", toEmail, subject, errMsg)
		}
		m.db.Create(&model.MailLog{
			RequestID: requestID,
			ToEmail:   toEmail,
			Subject:   subject,
			Status:    status,
			Error:     errMsg,
		})
	}()
}

// RecordSkipped 记录一条跳过发送的日志（用户未配置邮箱或已关闭通知）。未启用邮件时跳过。
func (m *Mailer) RecordSkipped(requestID *uint, toEmail, subject, reason string) {
	if m == nil || !m.cfg.MailEnabled {
		return
	}
	m.db.Create(&model.MailLog{
		RequestID: requestID,
		ToEmail:   toEmail,
		Subject:   subject,
		Status:    model.MailSkipped,
		Error:     reason,
	})
}

func (m *Mailer) send(toEmail, subject, htmlBody string) error {
	opts := []mail.Option{
		mail.WithTimeout(15 * time.Second),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithUsername(m.cfg.SMTPUser),
		mail.WithPassword(m.cfg.SMTPPassword),
	}
	if m.cfg.SMTPPort == 465 {
		opts = append(opts, mail.WithPort(m.cfg.SMTPPort), mail.WithSSLPort(false))
	} else {
		opts = append(opts, mail.WithPort(m.cfg.SMTPPort), mail.WithTLSPolicy(mail.TLSMandatory))
	}
	client, err := mail.NewClient(m.cfg.SMTPHost, opts...)
	if err != nil {
		return fmt.Errorf("创建 SMTP 客户端失败: %w", err)
	}

	msg := mail.NewMsg()
	if err := msg.From(m.cfg.SMTPUser); err != nil {
		return fmt.Errorf("设置发件人失败: %w", err)
	}
	if err := msg.To(toEmail); err != nil {
		return fmt.Errorf("设置收件人失败: %w", err)
	}
	msg.Subject(subject)
	msg.SetBodyString(mail.TypeTextHTML, htmlBody)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return client.DialAndSendWithContext(ctx, msg)
}

// ---- 中文邮件模板 ----

const layout = `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f5f6f7;font-family:'PingFang SC','Microsoft YaHei',sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e6eb;">
<div style="background:#1677ff;padding:16px 24px;color:#fff;font-size:18px;font-weight:600;">HomeOA 家庭审批</div>
<div style="padding:24px;color:#1d2129;line-height:1.7;">
%s
</div>
<div style="padding:12px 24px;background:#f7f8fa;color:#86909c;font-size:12px;">本邮件由 HomeOA 系统自动发送，请勿直接回复。</div>
</div></body></html>`

func kvRow(k, v string) string {
	return fmt.Sprintf(`<tr><td style="padding:6px 12px;color:#86909c;width:96px;white-space:nowrap;">%s</td><td style="padding:6px 12px;color:#1d2129;">%s</td></tr>`, k, v)
}

func esc(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, `"`, "&#34;")
	s = strings.ReplaceAll(s, `'`, "&#39;")
	return s
}

// RequestField 字段摘要，供模板展示。
type RequestField struct {
	Label string
	Value string
}

// StatusMail 生成事件通知邮件。event 描述发生了什么（如「有待你审批的新申请」），
// headline 为结果行（如「审批结果：✅ 通过」），fields 为键值摘要。
func (m *Mailer) StatusMail(event, headline string, fields []RequestField) (subject, body string) {
	var rows strings.Builder
	for _, f := range fields {
		rows.WriteString(kvRow(esc(f.Label), esc(f.Value)))
	}
	subject = fmt.Sprintf("【HomeOA】%s", event)
	body = fmt.Sprintf(layout,
		fmt.Sprintf(`<p style="margin:0 0 12px;font-size:16px;font-weight:600;">%s</p>
<p style="margin:0 0 16px;">%s</p>
<table style="border-collapse:collapse;width:100%%;background:#f7f8fa;border-radius:6px;">%s</table>
<p style="margin:16px 0 0;color:#86909c;font-size:13px;">请登录 HomeOA 查看详情。</p>`,
			esc(event), headline, rows.String()))
	return
}
