package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"homeoa/internal/mailer"
	"homeoa/internal/model"
)

type RequestService struct {
	DB     *gorm.DB
	Mailer *mailer.Mailer
}

// ---- 动态表单校验 ----

// ValidateFormData 按 Schema 清洗表单数据：只保留 Schema 定义的字段，
// 校验必填与类型；name=amount 的数值字段同步为金额，首个文本字段用作标题提示。
func ValidateFormData(schema *model.FormSchema, data map[string]any) (clean map[string]any, amount *float64, titleHint string, err error) {
	if data == nil {
		data = map[string]any{}
	}
	clean = map[string]any{}
	for _, f := range schema.Fields {
		raw, present := data[f.Name]
		if !present || raw == nil || (isString(raw) && strings.TrimSpace(toString(raw)) == "") {
			if f.Required {
				return nil, nil, "", fmt.Errorf("「%s」为必填项", f.Label)
			}
			continue
		}
		switch f.Type {
		case "number":
			v, nerr := toFloat(raw)
			if nerr != nil {
				return nil, nil, "", fmt.Errorf("「%s」必须是数字", f.Label)
			}
			clean[f.Name] = v
			if f.Name == "amount" {
				a := v
				amount = &a
			}
		case "date":
			s := strings.TrimSpace(toString(raw))
			t, perr := time.Parse("2006-01-02", s)
			if perr != nil {
				return nil, nil, "", fmt.Errorf("「%s」需要 YYYY-MM-DD 格式的日期", f.Label)
			}
			clean[f.Name] = t.Format("2006-01-02")
		default:
			s := strings.TrimSpace(toString(raw))
			if utf8Len(s) > 2000 {
				return nil, nil, "", fmt.Errorf("「%s」内容过长", f.Label)
			}
			clean[f.Name] = s
			if titleHint == "" && (f.Name == "item_name" || f.Name == "title") {
				titleHint = s
			}
		}
	}
	return clean, amount, titleHint, nil
}

func isString(v any) bool {
	_, ok := v.(string)
	return ok
}

func toString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func toFloat(v any) (float64, error) {
	switch n := v.(type) {
	case float64:
		return n, nil
	case float32:
		return float64(n), nil
	case int:
		return float64(n), nil
	case int64:
		return float64(n), nil
	case string:
		var f float64
		_, err := fmt.Sscanf(strings.TrimSpace(n), "%g", &f)
		return f, err
	default:
		return 0, errors.New("不是数字")
	}
}

func utf8Len(s string) int { return len([]rune(s)) }

// ---- 审批人解析与通知 ----

// approverOf 返回该类型的实际审批人（指定审批人或全部管理员）。
func (s *RequestService) approverOf(t *model.RequestType) ([]model.User, error) {
	if t.ApproverID != nil {
		var u model.User
		if err := s.DB.Select("id, username, display_name, email, mail_enabled").
			First(&u, *t.ApproverID).Error; err != nil {
			return nil, err
		}
		return []model.User{u}, nil
	}
	var admins []model.User
	err := s.DB.Where("role = ?", model.RoleAdmin).Find(&admins).Error
	return admins, err
}

// notifyApproverSide 给审批人（或全部管理员）发通知。
func (s *RequestService) notifyApproverSide(request *model.Request, event, headline string) {
	recipients, err := s.approverOf(request.Type)
	if err != nil {
		return
	}
	s.notify(recipients, request, event, headline)
}

func (s *RequestService) notify(recipients []model.User, request *model.Request, event, headline string) {
	if s.Mailer == nil {
		return
	}
	subject, body := s.Mailer.StatusMail(event, headline, s.mailFields(request))
	for _, u := range recipients {
		s.deliver(&u, request.ID, subject, body)
	}
}

// deliver 按用户的邮箱/通知配置投递或记录跳过，Mailer 未启用时静默返回。
func (s *RequestService) deliver(u *model.User, requestID uint, subject, body string) {
	if s.Mailer == nil {
		return
	}
	rid := requestID
	if !u.MailEnabled {
		s.Mailer.RecordSkipped(&rid, "(通知已关闭:"+u.Username+")", subject, "用户关闭了邮件通知")
		return
	}
	if u.Email == "" {
		s.Mailer.RecordSkipped(&rid, "(未配置邮箱:"+u.Username+")", subject, "用户未配置邮箱")
		return
	}
	s.Mailer.SendAsync(&rid, u.Email, subject, body)
}

func (s *RequestService) mailFields(r *model.Request) []mailer.RequestField {
	typeName := ""
	if r.Type != nil {
		typeName = r.Type.Name
	}
	submitter := ""
	if r.Submitter != nil {
		submitter = r.Submitter.DisplayName
	}
	fields := []mailer.RequestField{
		{Label: "申请标题", Value: r.Title},
		{Label: "申请类型", Value: typeName},
	}
	if r.Amount != nil {
		fields = append(fields, mailer.RequestField{Label: "预估金额", Value: fmt.Sprintf("%.2f 元", *r.Amount)})
	}
	fields = append(fields, mailer.RequestField{Label: "发起人", Value: submitter})
	if r.DecisionComment != "" {
		fields = append(fields, mailer.RequestField{Label: "审批意见", Value: r.DecisionComment})
	}
	return fields
}

// ---- 提交 / 重新提交 ----

type CreateRequestInput struct {
	TypeID   uint            `json:"type_id" binding:"required"`
	Title    string          `json:"title"`
	FormData json.RawMessage `json:"form_data"`
}

func (s *RequestService) Create(user *model.User, in CreateRequestInput) (*model.Request, error) {
	var t model.RequestType
	if err := s.DB.First(&t, in.TypeID).Error; err != nil {
		return nil, errors.New("请求类型不存在")
	}
	if !t.Enabled {
		return nil, errors.New("该请求类型已停用")
	}
	schema, err := model.ParseFormSchema(t.FormSchema)
	if err != nil {
		return nil, err
	}
	var data map[string]any
	if len(in.FormData) > 0 {
		if err := json.Unmarshal(in.FormData, &data); err != nil {
			return nil, errors.New("form_data 必须是 JSON 对象")
		}
	}
	clean, amount, hint, verr := ValidateFormData(schema, data)
	if verr != nil {
		return nil, verr
	}
	title := trimString(in.Title, 128)
	if title == "" {
		title = trimString(t.Name+"："+hint, 128)
		if title == t.Name {
			title = t.Name
		}
	}
	if amount != nil && *amount < 0 {
		return nil, errors.New("金额不能为负数")
	}
	raw, _ := json.Marshal(clean)

	req := model.Request{
		TypeID: t.ID, Title: title, Amount: amount,
		FormData: model.JSON(raw), Status: model.StatusPending, SubmitterID: user.ID,
	}
	logEntry := model.RequestLog{ActorID: user.ID, Action: model.ActionSubmit}
	err = s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&req).Error; err != nil {
			return err
		}
		logEntry.RequestID = req.ID
		return tx.Create(&logEntry).Error
	})
	if err != nil {
		return nil, err
	}

	req.Type, req.Submitter = &t, user
	s.notifyApproverSide(&req, "新申请待审批",
		fmt.Sprintf("📋 <b>%s</b> 提交了新的申请，等待你的审批。", escHTML(user.DisplayName)))
	return &req, nil
}

func escHTML(s string) string {
	r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&#34;")
	return r.Replace(s)
}

// Resubmit：退回后修改并重新提交。
func (s *RequestService) Resubmit(user *model.User, id uint, in CreateRequestInput) (*model.Request, error) {
	var req model.Request
	if err := s.DB.Preload("Type").First(&req, id).Error; err != nil {
		return nil, ErrNotFound
	}
	if req.SubmitterID != user.ID {
		return nil, ErrForbidden
	}
	if req.Status != model.StatusReturned {
		return nil, errors.New("只有被退回的申请才能重新提交")
	}
	schema, err := model.ParseFormSchema(req.Type.FormSchema)
	if err != nil {
		return nil, err
	}
	var data map[string]any
	if len(in.FormData) > 0 {
		if err := json.Unmarshal(in.FormData, &data); err != nil {
			return nil, errors.New("form_data 必须是 JSON 对象")
		}
	}
	clean, amount, hint, verr := ValidateFormData(schema, data)
	if verr != nil {
		return nil, verr
	}
	raw, _ := json.Marshal(clean)
	title := trimString(in.Title, 128)
	if title == "" {
		title = trimString(req.Type.Name+"："+hint, 128)
	}
	err = s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&req).Updates(map[string]any{
			"form_data": model.JSON(raw), "amount": amountPtrValue(amount), "title": title,
			"status": model.StatusPending, "approver_id": nil,
			"decision_comment": "", "decided_at": nil,
		}).Error; err != nil {
			return err
		}
		return tx.Create(&model.RequestLog{
			RequestID: req.ID, ActorID: user.ID, Action: model.ActionResubmit,
		}).Error
	})
	if err != nil {
		return nil, err
	}
	if err := s.DB.Preload("Type").First(&req, id).Error; err != nil {
		return nil, err
	}
	req.Submitter = user
	s.notifyApproverSide(&req, "申请已重新提交",
		fmt.Sprintf("🔄 <b>%s</b> 修改后重新提交了「%s」，等待你的审批。", escHTML(user.DisplayName), escHTML(req.Title)))
	return &req, nil
}

func amountPtrValue(p *float64) any {
	if p == nil {
		return nil
	}
	return *p
}

// ---- 列表 / 详情 ----

func (s *RequestService) List(user *model.User, scope, status string, typeID uint, page, pageSize int) ([]model.Request, int64, error) {
	q := s.DB.Model(&model.Request{})
	switch scope {
	case "mine":
		q = q.Where("submitter_id = ?", user.ID)
	case "pending":
		q = q.Where("status = ?", model.StatusPending)
		if user.Role != model.RoleAdmin {
			// 非管理员只能看到自己担任类型审批人的待办
			q = q.Joins("JOIN request_types ON request_types.id = requests.type_id").
				Where("request_types.approver_id = ?", user.ID)
		}
	case "all":
		if user.Role != model.RoleAdmin {
			return nil, 0, ErrForbidden
		}
	default:
		return nil, 0, errors.New("scope 取值必须是 mine / pending / all")
	}
	if status != "" {
		q = q.Where("requests.status = ?", status)
	}
	if typeID > 0 {
		q = q.Where("requests.type_id = ?", typeID)
	}
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
	var list []model.Request
	err := q.Preload("Type", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, code, name, icon, approver_id, enabled")
	}).Preload("Submitter", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, display_name")
	}).Preload("Approver", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, display_name")
	}).Order("created_at desc, id desc").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

func (s *RequestService) Get(user *model.User, id uint) (*model.Request, []model.RequestLog, error) {
	var req model.Request
	err := s.DB.Preload("Type", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, code, name, icon, approver_id, enabled")
	}).Preload("Submitter", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, display_name, email")
	}).Preload("Approver", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, display_name")
	}).First(&req, id).Error
	if err != nil {
		return nil, nil, ErrNotFound
	}
	if !s.canView(user, &req) {
		return nil, nil, ErrForbidden
	}
	var logs []model.RequestLog
	err = s.DB.Preload("Actor", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, display_name")
	}).Where("request_id = ?", id).Order("created_at asc, id asc").Find(&logs).Error
	return &req, logs, err
}

func (s *RequestService) canView(user *model.User, req *model.Request) bool {
	if user.Role == model.RoleAdmin || req.SubmitterID == user.ID {
		return true
	}
	return req.Type != nil && req.Type.ApproverID != nil && *req.Type.ApproverID == user.ID
}

func (s *RequestService) canDecide(user *model.User, req *model.Request) bool {
	if user.Role == model.RoleAdmin {
		return true
	}
	return req.Type != nil && req.Type.ApproverID != nil && *req.Type.ApproverID == user.ID
}

// ---- 审批动作 ----

type DecisionInput struct {
	Comment string `json:"comment"`
}

// Decide 处理 approve / reject / return。拒绝与退回必须填写意见。
func (s *RequestService) Decide(user *model.User, id uint, action, comment string) (*model.Request, error) {
	var req model.Request
	if err := s.DB.Preload("Type").Preload("Submitter", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, display_name, email, mail_enabled")
	}).First(&req, id).Error; err != nil {
		return nil, ErrNotFound
	}
	if !s.canDecide(user, &req) {
		return nil, ErrForbidden
	}
	if req.Status != model.StatusPending {
		return nil, errors.New("该申请不在待审批状态")
	}
	comment = trimString(comment, 512)
	if action != model.ActionApprove && comment == "" {
		return nil, errors.New("拒绝或退回时必须填写意见")
	}

	now := time.Now()
	status := map[string]string{
		model.ActionApprove: model.StatusApproved,
		model.ActionReject:  model.StatusRejected,
		model.ActionReturn:  model.StatusReturned,
	}[action]
	if status == "" {
		return nil, errors.New("未知的审批动作")
	}

	event, headline := "", ""
	switch action {
	case model.ActionApprove:
		event, headline = "你的申请已通过", "✅ 审批结果：<b>已通过</b>"
	case model.ActionReject:
		event, headline = "你的申请未通过", "❌ 审批结果：<b>未通过</b>"
	case model.ActionReturn:
		event, headline = "你的申请被退回", "↩️ 审批结果：<b>退回修改</b>，修改后可重新提交"
	}

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		// 带状态条件的乐观更新：并发下只有一个动作能生效
		res := tx.Model(&model.Request{}).
			Where("id = ? AND status = ?", req.ID, model.StatusPending).
			Updates(map[string]any{
				"status": status, "approver_id": user.ID,
				"decision_comment": comment, "decided_at": now,
			})
		if res.Error != nil {
			return Internal(res.Error)
		}
		if res.RowsAffected == 0 {
			return errors.New("该申请刚被处理，请刷新查看最新状态")
		}
		return tx.Create(&model.RequestLog{
			RequestID: req.ID, ActorID: user.ID, Action: action, Comment: comment,
		}).Error
	})
	if err != nil {
		return nil, err
	}

	req.Status, req.ApproverID, req.DecisionComment, req.DecidedAt = status, &user.ID, comment, &now
	req.Approver = &model.User{ID: user.ID, Username: user.Username, DisplayName: user.DisplayName}
	s.notifySubmitter(&req, event, headline, user)
	return &req, nil
}

// notifySubmitter 给提交人发结果通知。
func (s *RequestService) notifySubmitter(req *model.Request, event, headline string, decider *model.User) {
	if s.Mailer == nil || req.Submitter == nil {
		return
	}
	fields := s.mailFields(req)
	if decider != nil && req.DecisionComment != "" {
		fields = append(fields, mailer.RequestField{Label: "审批人", Value: decider.DisplayName})
	}
	subject, body := s.Mailer.StatusMail(event, headline, fields)
	s.deliver(req.Submitter, req.ID, subject, body)
}

// Withdraw 提交人撤回待审批的申请。
func (s *RequestService) Withdraw(user *model.User, id uint) error {
	var req model.Request
	if err := s.DB.Preload("Type").First(&req, id).Error; err != nil {
		return ErrNotFound
	}
	if req.SubmitterID != user.ID {
		return ErrForbidden
	}
	if req.Status != model.StatusPending {
		return errors.New("只有待审批的申请才能撤回")
	}
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&model.Request{}).
			Where("id = ? AND status = ?", req.ID, model.StatusPending).
			Updates(map[string]any{
				"status": model.StatusWithdrawn, "decided_at": time.Now(),
			})
		if res.Error != nil {
			return Internal(res.Error)
		}
		if res.RowsAffected == 0 {
			return errors.New("该申请刚被处理，请刷新查看最新状态")
		}
		return tx.Create(&model.RequestLog{
			RequestID: req.ID, ActorID: user.ID, Action: model.ActionWithdraw,
		}).Error
	})
	if err != nil {
		return err
	}
	req.Submitter = user
	s.notifyApproverSide(&req, "申请已撤回",
		fmt.Sprintf("🚫 <b>%s</b> 撤回了申请「%s」。", escHTML(user.DisplayName), escHTML(req.Title)))
	return nil
}

// Comment 参与者追加评论，通知对方。
func (s *RequestService) Comment(user *model.User, id uint, comment string) (*model.RequestLog, error) {
	comment = trimString(comment, 512)
	if comment == "" {
		return nil, errors.New("评论内容不能为空")
	}
	var req model.Request
	if err := s.DB.Preload("Type").Preload("Submitter", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, display_name, email, mail_enabled")
	}).First(&req, id).Error; err != nil {
		return nil, ErrNotFound
	}
	if !s.canView(user, &req) {
		return nil, ErrForbidden
	}
	entry := model.RequestLog{RequestID: req.ID, ActorID: user.ID, Action: model.ActionComment, Comment: comment}
	if err := s.DB.Create(&entry).Error; err != nil {
		return nil, err
	}
	entry.Actor = user

	event := "你的申请有新评论"
	if user.ID == req.SubmitterID {
		s.notifyApproverSide(&req, "申请有新评论",
			fmt.Sprintf("💬 <b>%s</b> 评论了申请「%s」：%s", escHTML(user.DisplayName), escHTML(req.Title), escHTML(comment)))
	} else if req.Submitter != nil && s.Mailer != nil {
		subject, body := s.Mailer.StatusMail(event, "💬 有新的评论", []mailer.RequestField{
			{Label: "申请标题", Value: req.Title},
			{Label: "评论人", Value: user.DisplayName},
			{Label: "评论内容", Value: comment},
		})
		s.deliver(req.Submitter, req.ID, subject, body)
	}
	return &entry, nil
}
