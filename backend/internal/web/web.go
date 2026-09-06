// Package web 通过 go:embed 将前端构建产物打进二进制，单文件同时托管前端与 API。
// 仓库内 dist/ 只包含占位页；Docker 多阶段构建会把真实前端产物复制到这里再编译。
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var embedded embed.FS

// Dist 返回以 dist 为根的只读文件系统。
func Dist() (fs.FS, error) {
	return fs.Sub(embedded, "dist")
}
