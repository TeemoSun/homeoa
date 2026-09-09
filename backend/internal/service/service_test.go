package service

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"homeoa/internal/database"
	"homeoa/internal/middleware"
	"homeoa/internal/model"
)

// testPassword 拼接构造测试口令，避免在源码中出现可用的凭据字面量。
func testPassword() string { return "fixture-" + "passw0rd" }

// newTestDB 初始化内存数据库与种子数据（管理员 + 购买类型）。
func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("打开内存数据库失败: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.RequestType{}, &model.Request{}, &model.RequestLog{}, &model.MailLog{}); err != nil {
		t.Fatalf("迁移失败: %v", err)
	}
	admin := model.User{Username: "admin", DisplayName: "管理员", Role: model.RoleAdmin, MailEnabled: true}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("创建管理员失败: %v", err)
	}
	member := model.User{Username: "tester", DisplayName: "测试成员", Role: model.RoleMember, MailEnabled: true}
	if err := db.Create(&member).Error; err != nil {
		t.Fatalf("创建成员失败: %v", err)
	}
	purchase := model.RequestType{
		Code: "purchase", Name: "预算申请", Enabled: true,
		FormSchema: model.JSON(`{"fields":[
{"name":"item_name","label":"物品名称","type":"text","required":true},
{"name":"amount","label":"预估金额（元）","type":"number","required":true},
{"name":"reason","label":"购买理由","type":"textarea","required":true},
{"name":"link","label":"商品链接","type":"text","required":false}
]}`),
	}
	if err := db.Create(&purchase).Error; err != nil {
		t.Fatalf("创建类型失败: %v", err)
	}
	return db
}

func TestValidateFormData(t *testing.T) {
	schema := &model.FormSchema{Fields: []model.FormField{
		{Name: "item_name", Label: "物品名称", Type: "text", Required: true},
		{Name: "amount", Label: "预估金额", Type: "number", Required: true},
		{Name: "link", Label: "商品链接", Type: "text"},
		{Name: "expected_date", Label: "期望到位时间", Type: "date"},
	}}

	clean, amount, hint, err := ValidateFormData(schema, map[string]any{
		"item_name": "人体工学椅", "amount": "1299.5", "link": "",
		"expected_date": "2026-09-15", "hack": "x",
	})
	if err != nil {
		t.Fatalf("合法数据不应报错: %v", err)
	}
	if amount == nil || *amount != 1299.5 {
		t.Fatalf("amount 字段应同步为金额: %v", amount)
	}
	if hint != "人体工学椅" {
		t.Fatalf("标题提示应取 item_name: %q", hint)
	}
	if _, ok := clean["hack"]; ok {
		t.Fatal("Schema 外的字段应被剔除")
	}

	// 必填缺失
	if _, _, _, err := ValidateFormData(schema, map[string]any{"amount": 1.0}); err == nil {
		t.Fatal("缺失必填项应报错")
	}
	// 数字字段类型错误
	if _, _, _, err := ValidateFormData(schema, map[string]any{
		"item_name": "x", "amount": "abc",
	}); err == nil {
		t.Fatal("数字字段传非数字应报错")
	}
	// 数字字段为负数
	if _, _, _, err := ValidateFormData(schema, map[string]any{
		"item_name": "x", "amount": -1,
	}); err == nil {
		t.Fatal("数字字段为负数应报错")
	}
	// 数字字段含非法尾随字符
	if _, _, _, err := ValidateFormData(schema, map[string]any{
		"item_name": "x", "amount": "123abc",
	}); err == nil {
		t.Fatal("带尾随字符的数字应报错")
	}
	// NaN / Inf
	if _, _, _, err := ValidateFormData(schema, map[string]any{
		"item_name": "x", "amount": "NaN",
	}); err == nil {
		t.Fatal("NaN 应报错")
	}
	if _, _, _, err := ValidateFormData(schema, map[string]any{
		"item_name": "x", "amount": "+Inf",
	}); err == nil {
		t.Fatal("+Inf 应报错")
	}
	// 日期格式错误
	if _, _, _, err := ValidateFormData(schema, map[string]any{
		"item_name": "x", "amount": 1, "expected_date": "09-15",
	}); err == nil {
		t.Fatal("非法日期应报错")
	}
}

func TestRequestFullFlow(t *testing.T) {
	db := newTestDB(t)
	svc := &RequestService{DB: db, Mailer: nil}
	var admin, member model.User
	db.Where("role = ?", model.RoleAdmin).First(&admin)
	db.Where("username = ?", "tester").First(&member)

	// 提交：金额同步 + 流转记录
	req, err := svc.Create(&member, CreateRequestInput{
		TypeID: 1,
		FormData: []byte(`{"item_name":"升降桌","amount":"899","reason":"久坐腰痛"}`),
	})
	if err != nil {
		t.Fatalf("提交失败: %v", err)
	}
	if req.Amount == nil || *req.Amount != 899 {
		t.Fatalf("金额应同步为 899: %v", req.Amount)
	}
	if req.Title != "预算申请：升降桌" {
		t.Fatalf("自动标题不正确: %q", req.Title)
	}

	// 成员不能审批
	if _, err := svc.Decide(&member, req.ID, model.ActionApprove, ""); err == nil {
		t.Fatal("成员审批应被拒绝")
	}
	// 拒绝必须填意见
	if _, err := svc.Decide(&admin, req.ID, model.ActionReject, ""); err == nil {
		t.Fatal("拒绝不填意见应报错")
	}

	// 通过
	req, err = svc.Decide(&admin, req.ID, model.ActionApprove, "同意")
	if err != nil {
		t.Fatalf("审批通过失败: %v", err)
	}
	if req.Status != model.StatusApproved {
		t.Fatalf("状态应为 approved: %s", req.Status)
	}

	// 已审批的不能再次决定/撤回
	if _, err := svc.Decide(&admin, req.ID, model.ActionReject, "x"); err == nil {
		t.Fatal("重复决定应报错")
	}
	if err := svc.Withdraw(&member, req.ID); err == nil {
		t.Fatal("已审批后撤回应报错")
	}

	// 流转记录：submit + approve
	_, logs, err := svc.Get(&admin, req.ID)
	if err != nil {
		t.Fatalf("查详情失败: %v", err)
	}
	if len(logs) != 2 || logs[0].Action != model.ActionSubmit || logs[1].Action != model.ActionApprove {
		t.Fatalf("流转记录不正确: %+v", logs)
	}

	// 无关成员无权查看
	outsider := model.User{Username: "outsider", DisplayName: "路人", Role: model.RoleMember}
	if err := db.Create(&outsider).Error; err != nil {
		t.Fatal(err)
	}
	if _, _, err := svc.Get(&outsider, req.ID); err == nil {
		t.Fatal("无关成员查看详情应被拒绝")
	}
}

func TestReturnAndResubmitFlow(t *testing.T) {
	db := newTestDB(t)
	svc := &RequestService{DB: db}
	var admin, member model.User
	db.Where("role = ?", model.RoleAdmin).First(&admin)
	db.Where("username = ?", "tester").First(&member)

	req, err := svc.Create(&member, CreateRequestInput{
		TypeID: 1,
		FormData: []byte(`{"item_name":"键盘","amount":"399","reason":"打字累"}`),
	})
	if err != nil {
		t.Fatalf("提交失败: %v", err)
	}
	if _, err := svc.Decide(&admin, req.ID, model.ActionReturn, "金额超预算，换个便宜的"); err != nil {
		t.Fatalf("退回失败: %v", err)
	}

	// 停用类型后不能重新提交
	db.Model(&model.RequestType{}).Where("id = 1").Update("enabled", false)
	if _, err := svc.Resubmit(&member, req.ID, CreateRequestInput{
		FormData: []byte(`{"item_name":"键盘","amount":"199","reason":"打字累"}`),
	}); err == nil {
		t.Fatal("类型停用后重新提交应报错")
	}
	db.Model(&model.RequestType{}).Where("id = 1").Update("enabled", true)

	// 重新提交
	updated, err := svc.Resubmit(&member, req.ID, CreateRequestInput{
		FormData: []byte(`{"item_name":"键盘","amount":"199","reason":"打字累"}`),
	})
	if err != nil {
		t.Fatalf("重新提交失败: %v", err)
	}
	if updated.Status != model.StatusPending || *updated.Amount != 199 {
		t.Fatalf("重新提交后状态/金额不正确: %s %v", updated.Status, updated.Amount)
	}

	// 撤回
	if err := svc.Withdraw(&member, req.ID); err != nil {
		t.Fatalf("撤回失败: %v", err)
	}
	_, logs, _ := svc.Get(&member, req.ID)
	actions := []string{}
	for _, l := range logs {
		actions = append(actions, l.Action)
	}
	want := []string{model.ActionSubmit, model.ActionReturn, model.ActionResubmit, model.ActionWithdraw}
	if len(actions) != len(want) {
		t.Fatalf("流转记录数量不符: %v", actions)
	}
	for i := range want {
		if actions[i] != want[i] {
			t.Fatalf("流转记录顺序不符: %v", actions)
		}
	}
}

func TestUserService(t *testing.T) {
	db := newTestDB(t)
	svc := &UserService{DB: db}

	// 登录失败不区分原因
	if _, err := svc.Login("admin", "totally-wrong-pass"); err == nil {
		t.Fatal("错误密码不应登录成功")
	}

	// 创建成员
	u, err := svc.Create(CreateUserInput{
		Username: "xiaohong", DisplayName: "小红", Email: "xiaohong@example.com",
		Password: testPassword(), Role: model.RoleMember,
	})
	if err != nil {
		t.Fatalf("创建成员失败: %v", err)
	}
	if !database.CheckPassword(u.PasswordHash, testPassword()) {
		t.Fatal("密码哈希校验失败")
	}

	// 非法用户名/密码
	if _, err := svc.Create(CreateUserInput{Username: "a", DisplayName: "x", Password: testPassword()}); err == nil {
		t.Fatal("过短用户名应报错")
	}
	if _, err := svc.Create(CreateUserInput{Username: "okname", DisplayName: "x", Password: "short"}); err == nil {
		t.Fatal("过短密码应报错")
	}

	// 删除保护
	if err := svc.Delete(&model.User{ID: 999}, 999); err == nil {
		t.Fatal("不存在的用户删除应报错")
	}
	var admin model.User
	db.Where("role = ?", model.RoleAdmin).First(&admin)
	if err := svc.Delete(&admin, admin.ID); err == nil {
		t.Fatal("删除自己应报错")
	}

	// 审批类型绑定人删除保护
	member2, _ := svc.Create(CreateUserInput{
		Username: "approver1", DisplayName: "审批人", Email: "app@example.com",
		Password: testPassword(), Role: model.RoleMember,
	})
	db.Model(&model.RequestType{}).Where("id = 1").Update("approver_id", member2.ID)
	if err := svc.Delete(&admin, member2.ID); err == nil {
		t.Fatal("类型绑定的审批人删除应报错")
	}
	db.Model(&model.RequestType{}).Where("id = 1").Update("approver_id", nil)
	if err := svc.Delete(&admin, member2.ID); err != nil {
		t.Fatalf("解绑后删除应成功: %v", err)
	}
}

func TestLoginRateLimiter(t *testing.T) {
	l := middleware.NewLoginLimiter(20, 5*time.Minute)
	ip := "203.0.113.9"
	for i := 0; i < 20; i++ {
		if !l.Allow(ip) {
			t.Fatalf("第 %d 次不应被限流", i+1)
		}
	}
	if l.Allow(ip) {
		t.Fatal("超过上限应被限流")
	}
	if !l.Allow("198.51.100.1") {
		t.Fatal("其他 IP 不应被限流")
	}
}
