// Package middleware 提供 JWT 认证、角色校验、登录限流与安全响应头。
package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"

	"homeoa/internal/model"
)

const ContextUserKey = "currentUser"

type JWTManager struct {
	secret []byte
	expire time.Duration
}

func NewJWTManager(secret []byte, expire time.Duration) *JWTManager {
	return &JWTManager{secret: secret, expire: expire}
}

func (j *JWTManager) Issue(userID uint, username, role string, tokenVersion int) (string, error) {
	claims := jwt.MapClaims{
		"sub":      userID,
		"username": username,
		"role":     role,
		"ver":      tokenVersion,
		"iat":      time.Now().Unix(),
		"exp":      time.Now().Add(j.expire).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(j.secret)
}

// Auth 校验 Bearer Token 并加载当前用户（用户被删除后旧 Token 立即失效）。
func Auth(jwtMgr *JWTManager, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			abort(c, http.StatusUnauthorized, "UNAUTHORIZED", "未登录或凭据缺失")
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return jwtMgr.secret, nil
		})
		if err != nil || !token.Valid {
			abort(c, http.StatusUnauthorized, "UNAUTHORIZED", "登录已过期，请重新登录")
			return
		}
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			abort(c, http.StatusUnauthorized, "UNAUTHORIZED", "无效的登录凭据")
			return
		}
		sub, ok := claims["sub"].(float64)
		if !ok {
			abort(c, http.StatusUnauthorized, "UNAUTHORIZED", "无效的登录凭据")
			return
		}
		var user model.User
		if err := db.First(&user, uint(sub)).Error; err != nil {
			abort(c, http.StatusUnauthorized, "UNAUTHORIZED", "账号不存在或已删除")
			return
		}
		// 密码变更后版本号递增，旧凭据立即失效
		if ver, ok := claims["ver"].(float64); !ok || int(ver) != user.TokenVersion {
			abort(c, http.StatusUnauthorized, "UNAUTHORIZED", "凭据已失效，请重新登录")
			return
		}
		c.Set(ContextUserKey, &user)
		c.Next()
	}
}

// Admin 仅允许管理员访问。
func Admin() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := CurrentUser(c)
		if user == nil || user.Role != model.RoleAdmin {
			abort(c, http.StatusForbidden, "FORBIDDEN", "需要管理员权限")
			return
		}
		c.Next()
	}
}

func CurrentUser(c *gin.Context) *model.User {
	if v, ok := c.Get(ContextUserKey); ok {
		if u, ok := v.(*model.User); ok {
			return u
		}
	}
	return nil
}

func abort(c *gin.Context, status int, code, msg string) {
	c.AbortWithStatusJSON(status, gin.H{"code": code, "message": msg})
}

// ---- 登录限流：每 IP 滑动窗口限次，缓解公网爆破 ----

type LoginLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	window   time.Duration
	max      int
	lastGC   time.Time
}

func NewLoginLimiter(max int, window time.Duration) *LoginLimiter {
	return &LoginLimiter{
		attempts: map[string][]time.Time{},
		window:   window, max: max, lastGC: time.Now(),
	}
}

func (l *LoginLimiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	// 定期淘汰长期不活跃的 IP，防止 map 无限增长
	if now.Sub(l.lastGC) > l.window {
		for k, ts := range l.attempts {
			if len(ts) == 0 || now.Sub(ts[len(ts)-1]) > l.window {
				delete(l.attempts, k)
			}
		}
		l.lastGC = now
	}
	kept := l.attempts[ip][:0]
	for _, t := range l.attempts[ip] {
		if now.Sub(t) < l.window {
			kept = append(kept, t)
		}
	}
	if len(kept) >= l.max {
		l.attempts[ip] = kept
		return false
	}
	l.attempts[ip] = append(kept, now)
	return true
}

func LoginRateLimit(limiter *LoginLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !limiter.Allow(c.ClientIP()) {
			c.Header("Retry-After", "300")
			abort(c, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS", "尝试次数过多，请稍后再试")
			return
		}
		c.Next()
	}
}

// SecureHeaders 设置基础安全响应头。
func SecureHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "no-referrer")
		// 前端全部资源同源加载；Semi Design 需要内联 style
		c.Header("Content-Security-Policy",
			"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'")
		c.Next()
	}
}

// MaxBody 限制请求体大小。
func MaxBody(limit int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		c.Next()
	}
}
