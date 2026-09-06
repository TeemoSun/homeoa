package service

import (
	"encoding/json"
	"errors"

	"gorm.io/gorm"

	"homeoa/internal/model"
)

type RequestTypeService struct {
	DB *gorm.DB
}

// List：管理员可看全部（含停用），普通成员只看启用类型。
func (s *RequestTypeService) List(user *model.User) ([]model.RequestType, error) {
	var types []model.RequestType
	q := s.DB.Preload("Approver", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, username, display_name")
	}).Order("id asc")
	if user.Role != model.RoleAdmin {
		q = q.Where("enabled = ?", true)
	}
	err := q.Find(&types).Error
	return types, err
}

func (s *RequestTypeService) GetByID(id uint) (*model.RequestType, error) {
	var t model.RequestType
	if err := s.DB.First(&t, id).Error; err != nil {
		return nil, ErrNotFound
	}
	return &t, nil
}

type SaveTypeInput struct {
	Code       string          `json:"code"`
	Name       string          `json:"name"`
	Icon       string          `json:"icon"`
	FormSchema json.RawMessage `json:"form_schema"`
	ApproverID *uint           `json:"approver_id"`
	Enabled    *bool           `json:"enabled"`
}

func (s *RequestTypeService) validate(in *SaveTypeInput) (*model.FormSchema, error) {
	in.Code = trimString(in.Code, 32)
	in.Name = trimString(in.Name, 64)
	in.Icon = trimString(in.Icon, 32)
	if !codeRe.MatchString(in.Code) {
		return nil, errors.New("类型编码只能包含小写字母、数字、中划线、下划线，长度 2-32 位")
	}
	if in.Name == "" {
		return nil, errors.New("请填写类型名称")
	}
	if len(in.FormSchema) == 0 {
		return nil, errors.New("请填写表单 Schema")
	}
	if !json.Valid(in.FormSchema) {
		return nil, errors.New("表单 Schema 不是合法 JSON")
	}
	var schema model.FormSchema
	if err := json.Unmarshal(in.FormSchema, &schema); err != nil {
		return nil, errors.New("表单 Schema 结构不正确，应为 {\"fields\":[...]}")
	}
	for i := range schema.Fields {
		schema.Fields[i].Name = trimString(schema.Fields[i].Name, 64)
		schema.Fields[i].Label = trimString(schema.Fields[i].Label, 64)
		schema.Fields[i].Placeholder = trimString(schema.Fields[i].Placeholder, 128)
	}
	if _, err := model.ParseFormSchema(model.JSON(encodeJSON(schema))); err != nil {
		return nil, err
	}
	if in.ApproverID != nil {
		var count int64
		if err := s.DB.Model(&model.User{}).Where("id = ?", *in.ApproverID).Count(&count).Error; err != nil {
			return nil, err
		}
		if count == 0 {
			return nil, errors.New("指定的审批人不存在")
		}
	}
	return &schema, nil
}

func encodeJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

func (s *RequestTypeService) Create(in SaveTypeInput) (*model.RequestType, error) {
	if _, err := s.validate(&in); err != nil {
		return nil, err
	}
	var count int64
	if err := s.DB.Model(&model.RequestType{}).Where("code = ?", in.Code).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, errors.New("类型编码已存在")
	}
	enabled := true
	if in.Enabled != nil {
		enabled = *in.Enabled
	}
	t := model.RequestType{
		Code: in.Code, Name: in.Name, Icon: in.Icon,
		FormSchema: model.JSON(encodeJSON(cleanSchema(in))), ApproverID: in.ApproverID, Enabled: enabled,
	}
	if err := s.DB.Create(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

// cleanSchema 保留规范化后的字段定义。
func cleanSchema(in SaveTypeInput) model.FormSchema {
	var schema model.FormSchema
	_ = json.Unmarshal(in.FormSchema, &schema)
	for i := range schema.Fields {
		schema.Fields[i].Name = trimString(schema.Fields[i].Name, 64)
		schema.Fields[i].Label = trimString(schema.Fields[i].Label, 64)
		schema.Fields[i].Placeholder = trimString(schema.Fields[i].Placeholder, 128)
	}
	return schema
}

func (s *RequestTypeService) Update(id uint, in SaveTypeInput) (*model.RequestType, error) {
	var t model.RequestType
	if err := s.DB.First(&t, id).Error; err != nil {
		return nil, ErrNotFound
	}
	if _, err := s.validate(&in); err != nil {
		return nil, err
	}
	var count int64
	if err := s.DB.Model(&model.RequestType{}).Where("code = ? AND id <> ?", in.Code, id).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, errors.New("类型编码已存在")
	}
	updates := map[string]any{
		"code": in.Code, "name": in.Name, "icon": in.Icon,
		"form_schema": model.JSON(encodeJSON(cleanSchema(in))),
		"approver_id": in.ApproverID, // NULL 表示由全部管理员审批
	}
	if in.Enabled != nil {
		updates["enabled"] = *in.Enabled
	}
	if err := s.DB.Model(&t).Updates(updates).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *RequestTypeService) Delete(id uint) error {
	var count int64
	if err := s.DB.Model(&model.Request{}).Where("type_id = ?", id).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("该类型下已有审批单，不能删除；可将其停用")
	}
	res := s.DB.Delete(&model.RequestType{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}
