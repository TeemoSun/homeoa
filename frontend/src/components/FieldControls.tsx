import { Checkbox, Switch } from '@heroui/react'
import type { ReactNode } from 'react'

// HeroUI v3 的 Switch/Checkbox 需要复合子组件才会渲染可视控件，这里统一封装

export function ToggleSwitch({
  isSelected,
  onChange,
  size = 'sm',
  ariaLabel,
}: {
  isSelected: boolean
  onChange: (selected: boolean) => void
  size?: 'sm' | 'md' | 'lg'
  ariaLabel?: string
}) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} size={size} aria-label={ariaLabel}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  )
}

export function CheckOption({
  isSelected,
  onChange,
  children,
}: {
  isSelected: boolean
  onChange: (selected: boolean) => void
  children: ReactNode
}) {
  return (
    <Checkbox isSelected={isSelected} onChange={onChange}>
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      <Checkbox.Content>{children}</Checkbox.Content>
    </Checkbox>
  )
}
