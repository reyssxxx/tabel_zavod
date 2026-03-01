"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { MarkTypeOption } from "@/types";
import type { CellClickInfo } from "./timesheet-cell";

interface CellPopupProps {
  info: CellClickInfo;
  markTypes: MarkTypeOption[];
  // actualHours: null = full day per schedule
  onApply: (employeeId: string, day: number, markTypeId: string | null, slot: number, overtimeHours: number, actualHours: number | null) => void;
  onClose: () => void;
}

const POPUP_WIDTH = 236;
const POPUP_HEIGHT_APPROX = 230;

// Quick-pick partial hours relative to schedule hours
const PARTIAL_PRESETS = [2, 4, 6];

export function CellPopup({ info, markTypes, onApply, onClose }: CellPopupProps) {
  const [tab, setTab] = useState<"mark" | "hours" | "ot">("mark");
  const [customOT, setCustomOT] = useState("");
  const [customActual, setCustomActual] = useState("");
  const popupRef = useRef<HTMLDivElement>(null);

  const { rect, employeeId, day, value, secondaryValue } = info;
  const currentOT = value?.overtimeHours ?? 0;
  const currentActual = value?.actualHours ?? null; // null = full day

  // Position: below if space, else above
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const openUpward = spaceBelow < POPUP_HEIGHT_APPROX;
  let left = rect.left + rect.width / 2 - POPUP_WIDTH / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - POPUP_WIDTH - 8));
  const top = openUpward ? rect.top - POPUP_HEIGHT_APPROX - 4 : rect.bottom + 4;

  // Close on outside click (delayed so opening click doesn't immediately close)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const apply = (
    markTypeId: string | null,
    slot: number,
    overtimeHours: number,
    actualHours: number | null = currentActual,
  ) => {
    onApply(employeeId, day, markTypeId, slot, overtimeHours, actualHours);
  };

  const clearDay = () => {
    onApply(employeeId, day, null, 0, 0, null);
    if (secondaryValue) onApply(employeeId, day, null, 1, 0, null);
    onClose();
  };

  const handleCustomOT = () => {
    const h = parseFloat(customOT);
    if (!isNaN(h) && h > 0) { apply(value?.markTypeId ?? null, 0, h); setCustomOT(""); }
  };

  const handleCustomActual = () => {
    const h = parseFloat(customActual);
    if (!isNaN(h) && h > 0) { apply(value?.markTypeId ?? null, 0, currentOT, h); setCustomActual(""); }
  };

  const btnBase: React.CSSProperties = {
    border: "1.5px solid #e5e7eb", borderRadius: 6, cursor: "pointer",
    backgroundColor: "transparent", fontWeight: 600,
  };

  return createPortal(
    <div ref={popupRef} style={{
      position: "fixed", top, left, zIndex: 99999,
      backgroundColor: "white", border: "1px solid #e5e7eb",
      borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.15)",
      width: POPUP_WIDTH, overflow: "hidden",
    }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
        {(["mark", "hours", "ot"] as const).map((t) => {
          const labels = { mark: "Отметка", hours: "Часы", ot: "Сверхур." };
          const active = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "7px 0", fontSize: 11, fontWeight: active ? 700 : 500,
              border: "none", borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
              backgroundColor: "transparent", cursor: "pointer",
              color: active ? "#1d4ed8" : "#6b7280", marginBottom: -1,
            }}>
              {labels[t]}
            </button>
          );
        })}
        <button onClick={onClose} style={{
          padding: "0 10px", border: "none", background: "transparent",
          cursor: "pointer", color: "#9ca3af", fontSize: 18, lineHeight: 1,
          marginBottom: -1, borderBottom: "2px solid transparent",
        }} title="Закрыть">×</button>
      </div>

      <div style={{ padding: "8px 10px" }}>

        {/* ── Отметка ── */}
        {tab === "mark" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 6 }}>
              {markTypes.map((mt) => {
                const isActive = value?.markTypeId === mt.id;
                return (
                  <button key={mt.id} onClick={() => apply(mt.id, 0, currentOT)} title={mt.name} style={{
                    ...btnBase,
                    padding: "5px 4px",
                    border: isActive ? `2px solid ${mt.color}` : "1.5px solid #e5e7eb",
                    backgroundColor: isActive ? mt.color + "33" : "transparent",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: mt.color }} />
                    <span style={{ fontSize: 11, fontFamily: "monospace" }}>{mt.code}</span>
                  </button>
                );
              })}
            </div>
            {/* Secondary mark (вторая половина дня) */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>Вторая половина дня:</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                {markTypes.map((mt) => {
                  const isActive = secondaryValue?.markTypeId === mt.id;
                  return (
                    <button key={"s" + mt.id} onClick={() => apply(mt.id, 1, 0, null)} title={mt.name} style={{
                      ...btnBase,
                      padding: "3px 2px",
                      border: isActive ? `2px solid ${mt.color}` : "1.5px solid #e5e7eb",
                      backgroundColor: isActive ? mt.color + "22" : "#fafafa",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                      opacity: 0.85,
                    }}>
                      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", backgroundColor: mt.color }} />
                      <span style={{ fontSize: 10, fontFamily: "monospace" }}>{mt.code}</span>
                    </button>
                  );
                })}
              </div>
              {secondaryValue && (
                <button onClick={() => apply(null, 1, 0, null)} style={{
                  marginTop: 4, width: "100%", padding: "3px 8px", fontSize: 10,
                  border: "1px solid #e5e7eb", borderRadius: 5, backgroundColor: "transparent",
                  cursor: "pointer", color: "#9ca3af",
                }}>
                  Убрать вторую половину
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Часы ── */}
        {tab === "hours" && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
              Фактически отработано (если меньше нормы):
            </div>
            {/* Full day reset */}
            <button
              onClick={() => apply(value?.markTypeId ?? null, 0, currentOT, null)}
              style={{
                ...btnBase,
                width: "100%", padding: "6px 8px", fontSize: 11, marginBottom: 6,
                border: currentActual === null ? "2px solid #3b82f6" : "1.5px solid #e5e7eb",
                backgroundColor: currentActual === null ? "#eff6ff" : "transparent",
                color: currentActual === null ? "#1d4ed8" : "#374151",
              }}
            >
              Полный день (по графику)
            </button>
            {/* Quick presets */}
            <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
              {PARTIAL_PRESETS.map((h) => {
                const isActive = currentActual === h;
                return (
                  <button key={h} onClick={() => apply(value?.markTypeId ?? null, 0, currentOT, h)} style={{
                    ...btnBase, flex: 1, padding: "7px 4px", fontSize: 12,
                    border: isActive ? "2px solid #f59e0b" : "1.5px solid #e5e7eb",
                    backgroundColor: isActive ? "#fffbeb" : "transparent",
                    color: isActive ? "#b45309" : "#374151",
                  }}>
                    {h}ч
                  </button>
                );
              })}
            </div>
            {/* Custom input */}
            <div style={{ display: "flex", gap: 5 }}>
              <input
                type="number" min={0.5} max={23.5} step={0.5}
                value={customActual}
                onChange={(e) => setCustomActual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCustomActual(); }}
                placeholder="другое кол-во часов"
                style={{
                  flex: 1, padding: "5px 8px", fontSize: 11,
                  border: "1.5px solid #e5e7eb", borderRadius: 6, outline: "none", minWidth: 0,
                }}
              />
              <button onClick={handleCustomActual} disabled={!customActual || isNaN(parseFloat(customActual))} style={{
                ...btnBase, padding: "5px 10px", fontSize: 11,
                backgroundColor: customActual ? "#f0fdf4" : "transparent",
                cursor: customActual ? "pointer" : "default",
                color: customActual ? "#16a34a" : "#9ca3af",
              }}>ОК</button>
            </div>
            {currentActual !== null && (
              <div style={{ marginTop: 5, fontSize: 11, color: "#b45309", textAlign: "center" }}>
                Сейчас: {currentActual}ч
                <button onClick={() => apply(value?.markTypeId ?? null, 0, currentOT, null)} style={{
                  marginLeft: 8, fontSize: 10, border: "none", background: "none",
                  cursor: "pointer", color: "#9ca3af", textDecoration: "underline",
                }}>сбросить</button>
              </div>
            )}
          </div>
        )}

        {/* ── Сверхурочные ── */}
        {tab === "ot" && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
              Часы сверх нормы:
            </div>
            <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
              {[1, 2, 3].map((h) => {
                const isActive = currentOT === h;
                return (
                  <button key={h} onClick={() => apply(value?.markTypeId ?? null, 0, isActive ? 0 : h)} style={{
                    ...btnBase, flex: 1, padding: "7px 4px", fontSize: 13,
                    border: isActive ? "2px solid #ef4444" : "1.5px solid #e5e7eb",
                    backgroundColor: isActive ? "#fef2f2" : "transparent",
                    color: isActive ? "#dc2626" : "#374151",
                  }}>
                    +{h}ч
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <input
                type="number" min={0.5} max={24} step={0.5}
                value={customOT}
                onChange={(e) => setCustomOT(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCustomOT(); }}
                placeholder="свой вариант"
                style={{
                  flex: 1, padding: "5px 8px", fontSize: 11,
                  border: "1.5px solid #e5e7eb", borderRadius: 6, outline: "none", minWidth: 0,
                }}
              />
              <button onClick={handleCustomOT} disabled={!customOT || isNaN(parseFloat(customOT))} style={{
                ...btnBase, padding: "5px 10px", fontSize: 11,
                backgroundColor: customOT ? "#f0fdf4" : "transparent",
                cursor: customOT ? "pointer" : "default",
                color: customOT ? "#16a34a" : "#9ca3af",
              }}>ОК</button>
            </div>
            {currentOT > 0 && (
              <div style={{ marginTop: 5, fontSize: 11, color: "#dc2626", textAlign: "center" }}>
                Сейчас: +{currentOT}ч
                <button onClick={() => apply(value?.markTypeId ?? null, 0, 0)} style={{
                  marginLeft: 8, fontSize: 10, border: "none", background: "none",
                  cursor: "pointer", color: "#9ca3af", textDecoration: "underline",
                }}>убрать</button>
              </div>
            )}
          </div>
        )}

        <button onClick={clearDay} style={{
          width: "100%", padding: "4px 8px", fontSize: 11, border: "1px solid #fee2e2",
          borderRadius: 6, backgroundColor: "#fff5f5", cursor: "pointer",
          color: "#ef4444", fontWeight: 500,
        }}>
          Очистить день
        </button>
      </div>
    </div>,
    document.body
  );
}
