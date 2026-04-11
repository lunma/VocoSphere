import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface SelectOption {
  label: string
  value: string
}

interface CustomSelectProps {
  value?: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
  className?: string
}

const CustomSelect = ({
  value,
  options,
  placeholder = '请选择',
  disabled = false,
  onChange,
  className = '',
}: CustomSelectProps) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((item) => item.value === value)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onEscape)

    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className={selected ? 'text-slate-700' : 'text-slate-400'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-[0_10px_38px_-10px_rgba(22,30,46,0.1)] p-1.5 animate-in fade-in zoom-in-95">
          {options.map((option) => {
            const isSelected = option.value === value

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>{option.label}</span>
                {isSelected ? <Check className="w-4 h-4 text-blue-600" /> : <span />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CustomSelect
