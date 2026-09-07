// 表单字段校验器：返回 undefined 表示通过，返回字符串作为错误提示
export type FieldValidator = (value: string) => string | undefined

export function required(msg: string): FieldValidator {
  return (v) => (v && v.trim() !== '' ? undefined : msg)
}

export function minLength(min: number, msg: string): FieldValidator {
  return (v) => (v && v.length < min ? msg : undefined)
}

export function pattern(re: RegExp, msg: string): FieldValidator {
  return (v) => (v && re.test(v.trim()) ? undefined : msg)
}

// 邮箱选填：填了才校验格式
export function optionalEmail(): FieldValidator {
  return (v) => (!v || v.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? undefined : '邮箱格式不正确')
}

export function compose(...validators: FieldValidator[]): FieldValidator {
  return (v) => {
    for (const check of validators) {
      const err = check(v)
      if (err) return err
    }
    return undefined
  }
}
