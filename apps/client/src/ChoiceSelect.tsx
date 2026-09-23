import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Props = React.SelectHTMLAttributes<HTMLSelectElement>;
export function ChoiceSelect({ children, value, defaultValue, onChange, disabled, className = "", ...props }: Props) {
  const options = React.Children.toArray(children).filter(React.isValidElement).map((child) => {
    const option = child as React.ReactElement<{ value: string | number; children: React.ReactNode; disabled?: boolean }>;
    return { value: String(option.props.value ?? ""), label: option.props.children, disabled: !!option.props.disabled };
  });
  const [local, setLocal] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const selected = String(value ?? local);
  const index = Math.max(0, options.findIndex((option) => option.value === selected));
  const current = options[index];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(index);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 300 });
  const button = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  function close() { setOpen(false); button.current?.focus(); }
  function choose(i: number) {
    const option = options[i];
    if (!option || option.disabled || disabled) return;
    setLocal(option.value);
    if (native.current) {
      native.current.value = option.value;
      onChange?.({ target: native.current, currentTarget: native.current } as React.ChangeEvent<HTMLSelectElement>);
    }
    close();
  }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = button.current!.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 24);
      const below = top + height - rect.bottom - 20;
      const above = rect.top - top - 20;
      const flip = below < 160 && above > below;
      const maxHeight = Math.max(80, Math.min(320, flip ? above : below));
      const actualHeight = Math.min(maxHeight, popup.current?.scrollHeight ?? maxHeight);
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: flip ? rect.top - actualHeight - 8 : rect.bottom + 8, width, maxHeight });
    };
    place(); popup.current?.focus();
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); window.visualViewport?.removeEventListener("resize", place); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <div className={`choice-select ${className}`}>
    <select {...props} ref={native} className="choice-native" tabIndex={-1} aria-hidden="true" disabled={disabled}
      value={current?.value ?? ""} onChange={(event) => { setLocal(event.target.value); onChange?.(event); }}
      onInvalid={(event) => { event.preventDefault(); button.current?.focus(); setActive(index); setOpen(true); }}>
      {children}
    </select>
    <button ref={button} type="button" className="choice-trigger" disabled={disabled || !options.length}
      aria-label={props["aria-label"]} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => { setActive(index); setOpen(!open); }}
      onKeyDown={(event) => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setActive(index); setOpen(true); } }}>
      <span>{current?.label ?? "Нет доступных вариантов"}</span><ChevronDown size={17} aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={popup} id={id} role="listbox" tabIndex={-1} className="choice-options" style={position}
      aria-label={props["aria-label"] ?? "Выберите вариант"} aria-activedescendant={`${id}-${active}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
        else if (event.key === "Tab") { event.preventDefault(); close(); }
        else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(active); }
        else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault(); const direction = event.key === "ArrowUp" || event.key === "End" ? -1 : 1;
          let next = event.key === "Home" ? -1 : event.key === "End" ? options.length : active;
          for (let n = 0; n < options.length; n++) { next = (next + direction + options.length) % options.length; if (!options[next].disabled) break; }
          setActive(next); document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: "nearest" });
        }
      }}>
      {options.map((option, i) => <button key={option.value} id={`${id}-${i}`} type="button" role="option" tabIndex={-1}
        aria-selected={option.value === current?.value} disabled={option.disabled}
        className={`choice-option ${i === active ? "is-active" : ""}`} onClick={() => choose(i)}>
        <span>{option.label}</span><span className="choice-mark" aria-hidden="true">{option.value === current?.value && <Check size={13} strokeWidth={3} />}</span>
      </button>)}
    </div>, document.body)}
  </div>;
}
