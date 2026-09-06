package service

import (
	"errors"

	"gorm.io/gorm"

	"homeoa/internal/database"
	"homeoa/internal/model"
)

type UserService struct {
	DB *gorm.DB
}

type UserProfile struct {
	ID          uint   `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	MailEnabled bool   `json:"mail_enabled"`
}

func toProfile(u *model.User) *UserProfile {
	return &UserProfile{
		ID: u.ID, Username: u.Username, DisplayName: u.DisplayName,
		Email: u.Email, Role: u.Role, MailEnabled: u.MailEnabled,
	}
}

// dummyHash 固定的 bcrypt 哈希：用户不存在时也执行一次比较，抹平时序差异。
var dummyHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// Login 校验用户名密码；失败时返回统一错误，不区分账号不存在与密码错误。
func (s *UserService) Login(username, password string) (*model.User, error) {
	username = trimString(username, 64)
	if username == "" || password == "" {
		return nil, errors.New("请输入用户名和密码")
	}
	var user model.User
	if err := s.DB.Where("username = ?", username).First(&user).Error; err != nil {
		database.CheckPassword(dummyHash, password)
		return nil, errors.New("用户名或密码错误")
	}
	if !database.CheckPassword(user.PasswordHash, password) {
		return nil, errors.New("用户名或密码错误")
	}
	return &user, nil
}

type UpdateMeInput struct {
	DisplayName  *string `json:"display_name"`
	Email        *string `json:"email"`
	MailEnabled  *bool   `json:"mail_enabled"`
	OldPassword  string  `json:"old_password"`
	NewPassword  string  `json:"new_password"`
}

// UpdateMe 更新个人信息；改密码需提供旧密码。
func (s *UserService) UpdateMe(user *model.User, in UpdateMeInput) error {
	updates := map[string]any{}
	if in.DisplayName != nil {
		v := trimString(*in.DisplayName, 64)
		if v == "" {
			return errors.New("姓名不能为空")
		}
		updates["display_name"] = v
	}
	if in.Email != nil {
		v := trimString(*in.Email, 128)
		if err := validateEmail(v); err != nil {
			return err
		}
		updates["email"] = v
	}
	if in.MailEnabled != nil {
		updates["mail_enabled"] = *in.MailEnabled
	}
	if in.NewPassword != "" {
		if err := validatePassword(in.NewPassword); err != nil {
			return err
		}
		if !database.CheckPassword(user.PasswordHash, in.OldPassword) {
			return errors.New("原密码不正确")
		}
		hash, err := database.HashPassword(in.NewPassword)
		if err != nil {
			return err
		}
		updates["password_hash"] = hash
		// 递增凭据版本，使已签发的登录凭据全部失效
		updates["token_version"] = gorm.Expr("token_version + 1")
	}
	if len(updates) == 0 {
		return errors.New("没有需要更新的内容")
	}
	return s.DB.Model(user).Updates(updates).Error
}

type CreateUserInput struct {
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Role        string `json:"role"`
}

func (s *UserService) Create(in CreateUserInput) (*model.User, error) {
	in.Username = trimString(in.Username, 32)
	in.DisplayName = trimString(in.DisplayName, 64)
	in.Email = trimString(in.Email, 128)
	if err := validateUsername(in.Username); err != nil {
		return nil, err
	}
	if in.DisplayName == "" {
		return nil, errors.New("请填写姓名")
	}
	if err := validateEmail(in.Email); err != nil {
		return nil, err
	}
	if err := validatePassword(in.Password); err != nil {
		return nil, err
	}
	if in.Role != model.RoleAdmin && in.Role != model.RoleMember {
		in.Role = model.RoleMember
	}
	var count int64
	if err := s.DB.Model(&model.User{}).Where("username = ?", in.Username).Count(&count).Error; err != nil {
		return nil, Internal(err)
	}
	if count > 0 {
		return nil, errors.New("用户名已存在")
	}
	hash, err := database.HashPassword(in.Password)
	if err != nil {
		return nil, err
	}
	user := model.User{
		Username: in.Username, PasswordHash: hash, DisplayName: in.DisplayName,
		Email: in.Email, Role: in.Role, MailEnabled: true,
	}
	if err := s.DB.Create(&user).Error; err != nil {
		return nil, Internal(err)
	}
	return &user, nil
}

type UpdateUserInput struct {
	DisplayName *string `json:"display_name"`
	Email       *string `json:"email"`
	Role        *string `json:"role"`
	MailEnabled *bool   `json:"mail_enabled"`
	Password    string  `json:"password"` // 非空 = 重置密码
}

func (s *UserService) Update(actor *model.User, id uint, in UpdateUserInput) (*model.User, error) {
	var user model.User
	if err := s.DB.First(&user, id).Error; err != nil {
		return nil, ErrNotFound
	}
	updates := map[string]any{}
	if in.DisplayName != nil {
		v := trimString(*in.DisplayName, 64)
		if v == "" {
			return nil, errors.New("姓名不能为空")
		}
		updates["display_name"] = v
	}
	if in.Email != nil {
		v := trimString(*in.Email, 128)
		if err := validateEmail(v); err != nil {
			return nil, err
		}
		updates["email"] = v
	}
	if in.MailEnabled != nil {
		updates["mail_enabled"] = *in.MailEnabled
	}
	if in.Role != nil {
		if *in.Role != model.RoleAdmin && *in.Role != model.RoleMember {
			return nil, errors.New("角色只能是 admin 或 member")
		}
		if user.Role == model.RoleAdmin && *in.Role != model.RoleAdmin && !s.leaveMoreThanOneAdmin(&user) {
			return nil, errors.New("至少需要保留一名管理员")
		}
		updates["role"] = *in.Role
	}
	if in.Password != "" {
		if err := validatePassword(in.Password); err != nil {
			return nil, err
		}
		hash, err := database.HashPassword(in.Password)
		if err != nil {
			return nil, err
		}
		updates["password_hash"] = hash
		updates["token_version"] = gorm.Expr("token_version + 1")
	}
	if len(updates) == 0 {
		return nil, errors.New("没有需要更新的内容")
	}
	if err := s.DB.Model(&user).Updates(updates).Error; err != nil {
		return nil, Internal(err)
	}
	return &user, nil
}

func (s *UserService) leaveMoreThanOneAdmin(changing *model.User) bool {
	var otherAdmins int64
	s.DB.Model(&model.User{}).
		Where("role = ? AND id <> ?", model.RoleAdmin, changing.ID).Count(&otherAdmins)
	return otherAdmins > 0
}

func (s *UserService) List() ([]model.User, error) {
	var users []model.User
	err := s.DB.Order("role asc, id asc").Find(&users).Error
	return users, err
}

func (s *UserService) Delete(actor *model.User, id uint) error {
	if actor.ID == id {
		return errors.New("不能删除自己的账号")
	}
	var user model.User
	if err := s.DB.First(&user, id).Error; err != nil {
		return ErrNotFound
	}
	if user.Role == model.RoleAdmin && !s.leaveMoreThanOneAdmin(&user) {
		return errors.New("至少需要保留一名管理员")
	}
	var refs int64
	if err := s.DB.Model(&model.Request{}).Where("submitter_id = ? OR approver_id = ?", id, id).Count(&refs).Error; err != nil {
		return Internal(err)
	}
	if refs > 0 {
		return errors.New("该用户名下存在关联审批单，不能删除；可改为停用其邮箱通知或改密")
	}
	if err := s.DB.Delete(&model.User{}, id).Error; err != nil {
		return Internal(err)
	}
	return nil
}
