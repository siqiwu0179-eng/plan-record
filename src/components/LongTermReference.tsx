import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, FileText, GraduationCap, Leaf, Lightbulb, Link, ListTodo, Pencil, Plus, Trash2, X } from "lucide-react";
import { DashboardPageHeader } from "./DashboardPageHeader";
import { CATEGORIES, CATEGORY_META } from "../constants";
import type { Category, LongTermPlan } from "../types";
import { blankDetails, rateOf, safeUrl, statusOf, type PlanState, type PlanDetails, type Compass } from "../utils/longTermLocal";
import { getLongTermStore } from "../utils/longTermStore";
import "./LongTermReference.css";

const tabs = [{ key: "notes", label: "笔记", icon: FileText }, { key: "resources", label: "相关资料", icon: Link }, { key: "ideas", label: "灵感想法", icon: Lightbulb }] as const;
type Tab = typeof tabs[number]["key"];
const compassCards = [{ key: "vision", title: "我的人生愿景", hint: "描绘想要的生活与未来", icon: Leaf }, { key: "creed", title: "人生信条", hint: "写下指引自己的信念", icon: Lightbulb }, { key: "fiveYears", title: "未来五年想达成的目标", hint: "为未来五年设定方向", icon: GraduationCap }] as const;
type CompassKey = typeof compassCards[number]["key"];
type Modal = { kind: "plan" | "step" | "notes" | "resources" | "ideas" | "delete" | "daily" | "compass"; compassKey?: CompassKey; id?: string; title: string; content: string; target?: Tab | "steps" | "plan" };
const planColors = ["#C7DCCF", "#D8D1E6", "#F6E8B8", "#FFD8B5", "#DDAAA1", "#E6E2DD"];
const planColor = (plan: LongTermPlan) => /^#[0-9a-f]{6}$/i.test(plan.color) ? plan.color : planColors[0];
const themeStyle = (color: string) => ({ "--plan-color": color, "--plan-wash": `${color}33`, "--plan-ink": `color-mix(in srgb, ${color} 42%, #344553)` } as CSSProperties);
const kindNames = { plan: "长期计划", step: "步骤", notes: "笔记", resources: "相关资料", ideas: "灵感想法" };

export function LongTermReference({ userId, cloudReady, menuOpen, onMenuToggle, onBack, onAddDaily }: {
  userId: string | null; cloudReady: boolean; menuOpen: boolean; onMenuToggle: () => void; onBack: () => void;
  onAddDaily: (title: string, category: Category) => void;
}) {
  const store = getLongTermStore(userId ?? "guest");
  const cloud = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const data = cloud.workspace;
  const compass = cloud.workspace.compass;
  const ready = Boolean(userId && cloudReady && cloud.ready);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("全部");
  const [tab, setTab] = useState<Tab>("notes");
  const [compassEdit, setCompassEdit] = useState<{ key: CompassKey; content: string } | null>(null);
  const [entryEdit, setEntryEdit] = useState<{ id: string | null; title: string; content: string } | null>(null);
  const entryTextarea = useRef<HTMLTextAreaElement>(null);
  const [entryDrag, setEntryDrag] = useState<string | null>(null);
  const [entryDrop, setEntryDrop] = useState<string | null>(null);
  useEffect(() => {
    const textarea = entryTextarea.current;
    const panel = textarea?.closest<HTMLElement>(".ltr-paper-content");
    if (!textarea || !panel) return;
    const resize = () => {
      // Reserve room for the title, action buttons, gaps, and row padding.
      const maximum = Math.max(48, panel.clientHeight - 104);
      textarea.style.height = "0px";
      const height = Math.min(Math.max(75, textarea.scrollHeight + 2), maximum);
      textarea.style.height = `${height}px`;
      textarea.style.overflowY = textarea.scrollHeight > height ? "auto" : "hidden";
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [entryEdit?.id, entryEdit?.content, tab]);
  const [menu, setMenu] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [localError, setError] = useState("");
  const error = localError || (!cloud.ready ? cloud.error : "");
  const [category, setCategory] = useState<Category>("study");
  const [creating, setCreating] = useState(false);
  const [newColor, setNewColor] = useState(planColors[0]);
  const [colorOpen, setColorOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<"name" | "goal" | null>(null);
  const [draft, setDraft] = useState("");
  const [stepEdit, setStepEdit] = useState<{ id: string | null; title: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [dailyPicker, setDailyPicker] = useState<{ title: string; left: number; top: number } | null>(null);
  useEffect(() => {
    if (!dailyPicker) return;
    const close = (event: PointerEvent) => { if (!(event.target as Element).closest(".ltr-daily-picker, .ltr-daily-trigger")) setDailyPicker(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setDailyPicker(null); };
    const scroll = () => setDailyPicker(null);
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    window.addEventListener("scroll", scroll, true); window.addEventListener("resize", scroll);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); window.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", scroll); };
  }, [dailyPicker]);
  const dialog = useRef<HTMLDialogElement>(null);
  const filtered = data.plans.filter(plan => (filter === "全部" || statusOf(plan, data.details[plan.id]) === filter));
  const selected = filtered.find(plan => plan.id === selectedId) ?? filtered[0];
  const meta = selected ? { ...blankDetails(), ...data.details[selected.id] } : blankDetails();

  useEffect(() => { setMenu(null); setModal(null); setTab("notes"); setColorOpen(false); setEntryEdit(null); setEntryDrag(null); setEntryDrop(null); setEditing(null); setStepEdit(null); setDailyPicker(null); setDragId(null); setDropId(null); }, [selected?.id]);
  useEffect(() => { if (modal) dialog.current?.showModal(); else dialog.current?.close(); }, [modal]);
  useEffect(() => {
    if (!menu) return;
    const popup = document.querySelector<HTMLElement>(".ltr-menu");
    const trigger = popup?.parentElement?.querySelector("button");
    if (popup && trigger) {
      const rect = trigger.getBoundingClientRect();
      popup.style.left = `${Math.max(8, Math.min(window.innerWidth - popup.offsetWidth - 8, rect.right - popup.offsetWidth))}px`;
      popup.style.top = `${Math.max(8, Math.min(rect.bottom + 5, window.innerHeight - popup.offsetHeight - 8))}px`;
    }
    const closeOnScroll = () => setMenu(null);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => { window.removeEventListener("scroll", closeOnScroll, true); window.removeEventListener("resize", closeOnScroll); };
  }, [menu]);
  useEffect(() => {
    if (userId && cloudReady) void store.refresh();
  }, [store, userId, cloudReady]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!(event.target as Element).closest(".ltr-menu-wrap")) setMenu(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  const commit = (next: PlanState) => {
    if (!ready) return false;
    setError("");
    return store.updatePlans(next);
  };
  const toggleStep = (planId: string, stepId: string) => {
    const current = store.getSnapshot().workspace;
    commit({ ...current, plans: current.plans.map(plan => plan.id === planId
      ? { ...plan, tasks: plan.tasks.map(step => step.id === stepId ? { ...step, done: !step.done } : step) }
      : plan) });
  };
  const commitCompass = (next: Compass) => {
    if (!ready) return false;
    setError("");
    return store.updateCompass(next);
  };
  const updatePlan = (change: (plan: LongTermPlan) => LongTermPlan) => {
    const current = store.getSnapshot().workspace;
    return selected && commit({ ...current, plans: current.plans.map(plan => plan.id === selected.id ? change(plan) : plan) });
  };
  const updateDetails = (patch: Partial<PlanDetails>) => {
    const current = store.getSnapshot().workspace;
    return selected && commit({ ...current, details: { ...current.details, [selected.id]: { ...blankDetails(), ...current.details[selected.id], ...patch } } });
  };
  const open = (value: Modal) => { setMenu(null); setError(""); setModal(value); };
  const saveCompass = () => {
    if (!compassEdit) return;
    const next = { ...compass, [compassEdit.key]: compassEdit.content };
    if (commitCompass(next)) setCompassEdit(null);
  };
  const saveEntry = () => {
    if (!entryEdit) return;
    if (!entryEdit.title.trim()) { setError("名称不能为空。"); return; }
    const content = tab === "resources" ? safeUrl(entryEdit.content) : entryEdit.content;
    if (content === null) { setError("资料链接必须是有效的 http 或 https 地址。"); return; }
    const entry = { id: entryEdit.id ?? crypto.randomUUID(), title: entryEdit.title.trim(), content };
    if (updateDetails({ [tab]: entryEdit.id ? meta[tab].map(item => item.id === entryEdit.id ? entry : item) : [...meta[tab], entry] })) setEntryEdit(null);
  };
  const moveEntry = (id: string, target: string) => {
    const entries = [...meta[tab]];
    const from = entries.findIndex(entry => entry.id === id), to = entries.findIndex(entry => entry.id === target);
    if (from < 0 || to < 0 || from === to) return;
    const [entry] = entries.splice(from, 1); entries.splice(to, 0, entry);
    updateDetails({ [tab]: entries });
  };
  const entryEditor = () => <form className="ltr-entry-editor" onSubmit={event => { event.preventDefault(); saveEntry(); }} onKeyDown={event => { if (event.key === "Escape") { setEntryEdit(null); setError(""); } }}>
    <input autoFocus aria-label="手记名称" placeholder={tab === "resources" ? "资料名称" : "写下标题"} maxLength={100} value={entryEdit?.title ?? ""} onChange={event => setEntryEdit(current => current && { ...current, title: event.target.value })} />
    {tab === "resources" ? <input aria-label="资料链接" placeholder="https://…" value={entryEdit?.content ?? ""} onChange={event => setEntryEdit(current => current && { ...current, content: event.target.value })} /> : <textarea ref={entryTextarea} aria-label="手记内容" placeholder="直接在这里记录…" rows={3} value={entryEdit?.content ?? ""} onChange={event => setEntryEdit(current => current && { ...current, content: event.target.value })} />}
    <div className="ltr-inline-actions"><button type="submit" className="ltr-icon-action" aria-label="保存手记" title="保存"><Check size={17} /></button><button type="button" className="ltr-icon-action" aria-label="取消编辑手记" title="取消" onClick={() => { setEntryEdit(null); setError(""); }}><X size={17} /></button></div>
  </form>;
  const saveStep = () => {
    if (!stepEdit) return;
    if (!stepEdit.title.trim()) { setError("步骤内容不能为空。"); return; }
    if (updatePlan(plan => ({ ...plan, tasks: stepEdit.id ? plan.tasks.map(step => step.id === stepEdit.id ? { ...step, title: stepEdit.title.trim() } : step) : [...plan.tasks, { id: crypto.randomUUID(), title: stepEdit.title.trim(), done: false }] }))) setStepEdit(null);
  };
  const stepEditor = () => <form className="ltr-step-editor" onSubmit={event => { event.preventDefault(); saveStep(); }}>
    <input autoFocus aria-label="步骤内容" placeholder="输入步骤内容" value={stepEdit?.title ?? ""} onChange={event => setStepEdit(current => current && { ...current, title: event.target.value })} onKeyDown={event => { if (event.key === "Escape") { setStepEdit(null); setError(""); } }} />
    <button type="submit" className="ltr-icon-action" title="保存步骤" aria-label="保存步骤"><Check size={17} /></button>
    <button type="button" className="ltr-icon-action" title="取消" aria-label="取消编辑步骤" onClick={() => { setStepEdit(null); setError(""); }}><X size={17} /></button>
  </form>;
  const moveStep = (id: string, target: string) => updatePlan(plan => {
    const tasks = [...plan.tasks];
    const from = tasks.findIndex(step => step.id === id), to = tasks.findIndex(step => step.id === target);
    if (from < 0 || to < 0 || from === to) return plan;
    const [step] = tasks.splice(from, 1); tasks.splice(to, 0, step);
    return { ...plan, tasks };
  });
  const createPlan = () => {
    if (!newName.trim()) { setError("名称不能为空。"); return; }
    const id = crypto.randomUUID();
    if (commit({ plans: [{ id, name: newName.trim(), color: newColor, tasks: [] }, ...data.plans], details: { ...data.details, [id]: blankDetails() } })) {
      setSelectedId(id); setFilter("全部"); setCreating(false); setNewName("");
    }
  };
  const saveInline = () => {
    if (editing === "name" && !draft.trim()) { setError("名称不能为空。"); return; }
    const saved = editing === "name" ? updatePlan(plan => ({ ...plan, name: draft.trim() })) : updateDetails({ goal: draft.trim() });
    if (saved) setEditing(null);
  };
  const headingField = (field: "name" | "goal", value: string) => (
    <div className={`ltr-inline-field ltr-inline-${field}`}>
      {editing === field ? <form onSubmit={event => { event.preventDefault(); saveInline(); }}>
        <input autoFocus aria-label={field === "name" ? "计划名称" : "一句话目标"} maxLength={field === "name" ? 100 : 500} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setEditing(null); setError(""); } }} />
        <button type="submit" className="ltr-icon-action" title="保存" aria-label="保存"><Check size={17} /></button>
        <button type="button" className="ltr-icon-action" title="取消" aria-label="取消" onClick={() => { setEditing(null); setError(""); }}><X size={17} /></button>
      </form> : <>
        {field === "name" ? <h2>{value}</h2> : <p>{value || "暂无目标描述"}</p>}
        <button type="button" className="ltr-icon-action ltr-hover-pencil" title={field === "name" ? "编辑名称" : "编辑目标"} aria-label={field === "name" ? "编辑名称" : "编辑目标"} onClick={() => { setEditing(field); setDraft(value); setError(""); }}><Pencil size={16} /></button>
      </>}
    </div>
  );
  const addDaily = (title: string, category: Category) => {
    if (!ready) return false;
    onAddDaily(title, category);
    setError("");
    return true;
  };
  const submit = async () => {
    if (!modal) return;
    let saved = false;
    if (modal.kind === "compass" && modal.compassKey) {
      const next = { ...compass, [modal.compassKey]: modal.content };
      if (commitCompass(next)) setModal(null);
      return;
    }
    if (modal.kind === "delete" && selected) {
      if (modal.target === "plan") {
        const details = { ...data.details }; delete details[selected.id];
        saved = commit({ plans: data.plans.filter(plan => plan.id !== selected.id), details });
      } else if (modal.target === "steps") saved = Boolean(updatePlan(plan => ({ ...plan, tasks: plan.tasks.filter(step => step.id !== modal.id) })));
      else if (modal.target) saved = Boolean(updateDetails({ [modal.target]: meta[modal.target].filter(entry => entry.id !== modal.id) }));
    } else if (modal.kind === "daily") {
      saved = addDaily(modal.title, category);
    } else if (!modal.title.trim()) { setError("名称不能为空。"); return;
    } else if (modal.kind === "plan") {
      const id = modal.id ?? crypto.randomUUID();
      saved = commit({ plans: modal.id ? data.plans.map(plan => plan.id === id ? { ...plan, name: modal.title.trim() } : plan) : [...data.plans, { id, name: modal.title.trim(), color: "#C7DCCF", tasks: [] }], details: { ...data.details, [id]: { ...blankDetails(), ...data.details[id], goal: modal.content.trim() } } });
      if (saved) { setSelectedId(id); setFilter("全部"); }
    } else if (modal.kind === "step") {
      saved = Boolean(updatePlan(plan => ({ ...plan, tasks: modal.id ? plan.tasks.map(step => step.id === modal.id ? { ...step, title: modal.title.trim() } : step) : [...plan.tasks, { id: crypto.randomUUID(), title: modal.title.trim(), done: false }] })));
    } else if (modal.kind === "notes" || modal.kind === "resources" || modal.kind === "ideas") {
      const content = modal.kind === "resources" ? safeUrl(modal.content) : modal.content;
      if (content === null) { setError("资料链接必须是有效的 http 或 https 地址。"); return; }
      const entry = { id: modal.id ?? crypto.randomUUID(), title: modal.title.trim(), content };
      saved = Boolean(updateDetails({ [modal.kind]: modal.id ? meta[modal.kind].map(item => item.id === modal.id ? entry : item) : [...meta[modal.kind], entry] }));
    }
    if (saved) setModal(null);
  };
  const addLabel = { steps: "添加步骤", notes: "添加笔记", resources: "添加资料", ideas: "添加想法" }[tab];
  return (
    <div className="inner-page-scroll-room px-3 pb-8 sm:px-4">
      <div className="mx-auto w-full max-w-[1400px]">
        <DashboardPageHeader title="长期计划" menuOpen={menuOpen} onMenuToggle={onMenuToggle} onBack={onBack} />
        <div className="ltr-content mt-3.5" aria-busy={!ready}>
          {!ready && !error && <p role="status">正在读取云端长期计划…</p>}
          <fieldset disabled={!ready} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "contents" }}>
          {error && !modal && <p role="alert">{error}</p>}
          <div className="ltr-compass" aria-label="人生方向">
            {compassCards.map(({ key, title, hint, icon: CardIcon }) => <section key={key} className="glass-panel ltr-compass-card">
              <div className="ltr-compass-heading"><CardIcon size={20} /><h2>{title}</h2>{compassEdit?.key !== key && <button type="button" className="ltr-icon-action" aria-label={`编辑${title}`} onClick={() => { setCompassEdit({ key, content: compass[key] ?? "" }); setError(""); }}><Pencil size={15} /></button>}</div>
              {compassEdit?.key === key ? <form className="ltr-compass-editor" onSubmit={event => { event.preventDefault(); saveCompass(); }}>
                <textarea autoFocus aria-label={title} value={compassEdit.content} placeholder={hint} onChange={event => setCompassEdit({ key, content: event.target.value })} onKeyDown={event => { if (event.key === "Escape") setCompassEdit(null); }} />
                <div className="ltr-inline-actions"><button type="submit" className="ltr-icon-action" aria-label={`保存${title}`} title="保存"><Check size={16} /></button><button type="button" className="ltr-icon-action" aria-label={`取消编辑${title}`} title="取消" onClick={() => setCompassEdit(null)}><X size={16} /></button></div>
              </form> : <button type="button" className="ltr-compass-read" aria-label={`查看与编辑${title}`} onClick={() => { setCompassEdit({ key, content: compass[key] ?? "" }); setError(""); }}><p className={compass[key]?.trim() ? "" : "is-placeholder"}>{compass[key]?.trim() || hint}</p><span>查看与编辑<ChevronRight size={14} /></span></button>}
            </section>)}
          </div>
          <div className="ltr-columns">
            <section className="glass-panel ltr-panel ltr-list" aria-label="长期计划列表">
              <div className="ltr-directory-heading"><h2 className="ltr-directory-title">我的长期计划</h2><button type="button" className="ltr-icon-action ltr-new-plan" aria-label="新建计划" title="新建计划" onClick={() => { setCreating(true); setNewName(""); setNewColor(planColors[0]); setError(""); }}><Plus size={20} /></button></div>
              <div className="ltr-filters">{["全部", "进行中", "已完成", "已搁置"].map(value => <button type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} key={value} onClick={() => { setFilter(value); setMenu(null); }}>{value} ({value === "全部" ? data.plans.length : data.plans.filter(plan => statusOf(plan, data.details[plan.id]) === value).length})</button>)}</div>
              <div className="ltr-cards" style={{ gridTemplateRows: `repeat(${Math.max(5, filtered.length + (creating ? 1 : 0))},minmax(84px,1fr))` }}>
                {creating && <form className="ltr-card ltr-new-card is-selected" onSubmit={event => { event.preventDefault(); createPlan(); }}>
                  <div className="ltr-new-color-preview" style={{ background: newColor }} aria-hidden="true" />
                  <input autoFocus aria-label="新计划名称" placeholder="输入计划名称" maxLength={100} value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === "Escape") { setCreating(false); setError(""); } }} />
                  <button type="submit" className="ltr-icon-action" aria-label="确认新建计划" title="确认"><Check size={18} /></button>
                  <button type="button" className="ltr-icon-action" aria-label="取消新建计划" title="取消" onClick={() => { setCreating(false); setError(""); }}><X size={18} /></button>
                  <fieldset className="ltr-color-picker"><legend>选择计划颜色</legend>{planColors.map(color => <button key={color} type="button" className="ltr-color-swatch" style={{ background: color }} aria-label={`选择计划颜色 ${color}`} aria-pressed={newColor === color} onClick={() => setNewColor(color)}>{newColor === color && <Check size={15} />}</button>)}</fieldset>
                </form>}
                {filtered.map(plan => { const rate = rateOf(plan); return (
                  <button type="button" aria-pressed={selected?.id === plan.id} onClick={() => setSelectedId(plan.id)} className={`ltr-card ltr-themed-card ${selected?.id === plan.id ? "is-selected" : ""}`} style={themeStyle(planColor(plan))} key={plan.id}>
                    <div className="ltr-plan-band" aria-hidden="true" />
                    <div className="ltr-card-copy"><h2>{plan.name}</h2><div className="ltr-card-progress"><div className="ltr-track"><span style={{ width: `${rate}%` }} /></div><b>{rate}%</b></div></div>
                    <ChevronRight className="ltr-chevron" size={21} />
                  </button>
                ); })}
                {!filtered.length && !creating && <p className="ltr-empty">暂无符合条件的计划</p>}
              </div>
            </section>
            <section className="glass-panel ltr-panel ltr-detail" style={themeStyle(selected ? planColor(selected) : planColors[0])} aria-label="长期计划详情">
              {selected ? <>
                <div className="ltr-themed-summary">
                <div className="ltr-detail-heading">
                  <div className="ltr-theme-control"><button type="button" className="ltr-theme-trigger" style={{ background: planColor(selected) }} aria-label="选择计划颜色" title="选择计划颜色" aria-expanded={colorOpen} onClick={() => setColorOpen(!colorOpen)}><Pencil size={16} /></button>{colorOpen && <fieldset className="ltr-color-picker ltr-color-popover" onKeyDown={event => { if (event.key === "Escape") setColorOpen(false); }}><legend>选择计划颜色</legend>{planColors.map(color => <button key={color} type="button" className="ltr-color-swatch" style={{ background: color }} aria-label={`选择计划颜色 ${color}`} aria-pressed={planColor(selected).toUpperCase() === color} onClick={() => updatePlan(plan => ({ ...plan, color }))}>{planColor(selected).toUpperCase() === color && <Check size={15} />}</button>)}<button type="button" className="ltr-icon-action" aria-label="关闭颜色选择" onClick={() => setColorOpen(false)}><X size={16} /></button></fieldset>}</div>
                  <div className="ltr-heading-copy">{headingField("name", selected.name)}{headingField("goal", meta.goal)}</div>
                  <div className="ltr-plan-actions">
                    <button type="button" className={`ltr-text-action ${meta.paused ? "is-active" : ""}`} title={meta.paused ? "恢复进行" : "搁置"} aria-label="搁置" aria-pressed={meta.paused} onClick={() => updateDetails({ paused: !meta.paused })}>搁置</button>
                    <button type="button" className="ltr-text-action is-danger" title="删除" aria-label="删除计划" onClick={() => open({ kind: "delete", target: "plan", title: selected.name, content: "删除计划及其步骤、笔记、资料和想法？已加入 Daily Plan 的任务会保留。" })}>删除</button>
                  </div>
                </div>
                <div className="ltr-overall-progress"><div className="ltr-track"><span style={{ width: `${rateOf(selected)}%` }} /></div><b>{rateOf(selected)}%</b></div>
                </div>
                <div className="ltr-detail-body">
                  <section className="ltr-milestones" aria-label="里程碑与步骤">
                    <div className="ltr-section-heading"><h3><ListTodo size={18} />里程碑与步骤</h3><button type="button" className="ltr-add-step" onClick={() => { setStepEdit({ id: null, title: "" }); setError(""); }}><Plus size={17} />添加步骤</button></div>
                    <div className="ltr-checklist">
                      {selected.tasks.map(step => <div className={`ltr-step ${dropId === step.id ? "is-drop-target" : ""} ${dragId === step.id ? "is-dragging" : ""}`} key={step.id}
                    onDragOver={event => { if (dragId) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropId(step.id); } }}
                    onDrop={event => { event.preventDefault(); if (dragId) moveStep(dragId, step.id); setDragId(null); setDropId(null); }}>
                    <button type="button" className="ltr-drag-handle" draggable title="拖拽排序（或使用上下方向键）" aria-label={`调整步骤顺序：${step.title}`}
                      onDragStart={event => { setDragId(step.id); setDailyPicker(null); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", step.id); if (event.currentTarget.parentElement) event.dataTransfer.setDragImage(event.currentTarget.parentElement, 20, 20); }}
                      onDragEnd={() => { setDragId(null); setDropId(null); }}
                      onKeyDown={event => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); const index = selected.tasks.findIndex(item => item.id === step.id); const target = selected.tasks[index + (event.key === "ArrowUp" ? -1 : 1)]; if (target) moveStep(step.id, target.id); } }}>
                      <span /><span /><span /><span />
                    </button><button type="button" role="checkbox" aria-checked={step.done} aria-label={`完成步骤：${step.title}`} className={`ltr-checkbox ${step.done ? "is-checked" : ""}`} onClick={() => toggleStep(selected.id, step.id)}>{step.done && <Check size={16} strokeWidth={3} />}</button>{stepEdit?.id === step.id ? stepEditor() : <span className={step.done ? "ltr-done" : ""}>{step.title}</span>}{stepEdit?.id !== step.id && <div className="ltr-step-actions">
                    <button type="button" className="ltr-icon-action" title="编辑步骤" aria-label={`编辑步骤：${step.title}`} onClick={() => { setStepEdit({ id: step.id, title: step.title }); setError(""); }}><Pencil size={17} /></button>
                    <button type="button" className="ltr-icon-action ltr-daily-trigger" title="加入每日计划" aria-label={`加入每日计划：${step.title}`} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setDailyPicker({ title: step.title, left: Math.max(8, Math.min(rect.right - 180, window.innerWidth - 188)), top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 310)) }); }}><Plus size={18} /></button>
                    <button type="button" className="ltr-icon-action is-danger" title="删除步骤" aria-label={`删除步骤：${step.title}`} onClick={() => { if (updatePlan(plan => ({ ...plan, tasks: plan.tasks.filter(item => item.id !== step.id) })) && stepEdit?.id === step.id) setStepEdit(null); }}><Trash2 size={17} /></button>
                  </div>}</div>)}
                      {stepEdit?.id === null && <div className="ltr-step ltr-new-step">{stepEditor()}</div>}
                      {!selected.tasks.length && !stepEdit && <p className="ltr-empty">暂无步骤，点击「添加步骤」开始。</p>}
                    </div>
                  </section>
                  <section className={`ltr-workspace ltr-paper-${tab}`} aria-label="计划手记">
                    <div className="ltr-tabs" role="tablist" aria-orientation="horizontal" aria-label="长期计划内容">{tabs.map(({ key, label, icon: TabIcon }) => <div className="ltr-tab-slot" key={key} role="presentation"><button type="button" role="tab" id={`ltr-tab-${key}`} aria-controls="ltr-paper-panel" aria-selected={tab === key} className={`ltr-tab ${tab === key ? "is-active" : ""}`} onClick={() => { setTab(key); setMenu(null); setEntryEdit(null); setEntryDrag(null); setEntryDrop(null); setError(""); }}><TabIcon />{label}</button>{tab === key && <button type="button" className="ltr-tab-add" aria-label={addLabel} title={addLabel} onClick={() => { setEntryEdit({ id: null, title: "", content: "" }); setError(""); }}><Plus size={16} /></button>}</div>)}</div>
                    <div className={`ltr-notebook-sheet ${entryEdit ? "is-editing" : ""}`}>

                    <div className="ltr-paper-content" id="ltr-paper-panel" role="tabpanel" aria-labelledby={`ltr-tab-${tab}`}>
                      {meta[tab].map(entry => <div className={`ltr-entry ltr-entry-row ${entryDrag === entry.id ? "is-dragging" : ""} ${entryDrop === entry.id ? "is-drop-target" : ""}`} key={entry.id}
                        onDragOver={event => { if (entryDrag) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setEntryDrop(entry.id); } }}
                        onDrop={event => { event.preventDefault(); if (entryDrag) moveEntry(entryDrag, entry.id); setEntryDrag(null); setEntryDrop(null); }}>
                        <button type="button" className="ltr-drag-handle" draggable title="拖拽排序（或使用上下方向键）" aria-label={`调整手记顺序：${entry.title}`}
                          onDragStart={event => { setEntryDrag(entry.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", entry.id); if (event.currentTarget.parentElement) event.dataTransfer.setDragImage(event.currentTarget.parentElement, 20, 20); }}
                          onDragEnd={() => { setEntryDrag(null); setEntryDrop(null); }}
                          onKeyDown={event => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); const index = meta[tab].findIndex(item => item.id === entry.id); const target = meta[tab][index + (event.key === "ArrowUp" ? -1 : 1)]; if (target) moveEntry(entry.id, target.id); } }}><span /><span /><span /><span /></button>
                        {entryEdit?.id === entry.id ? entryEditor() : <><div className="ltr-entry-copy"><h3>{entry.title}</h3>{tab === "resources" ? <a href={safeUrl(entry.content) ?? undefined} target="_blank" rel="noreferrer">{entry.content}</a> : <p>{entry.content}</p>}</div><div className="ltr-entry-actions"><button type="button" className="ltr-icon-action" aria-label={`编辑手记：${entry.title}`} title="编辑" onClick={() => { setEntryEdit(entry); setError(""); }}><Pencil size={17} /></button><button type="button" className="ltr-icon-action is-danger" aria-label={`删除手记：${entry.title}`} title="删除" onClick={() => { if (updateDetails({ [tab]: meta[tab].filter(item => item.id !== entry.id) })) setEntryEdit(null); }}><Trash2 size={17} /></button></div></>}
                      </div>)}
                      {entryEdit?.id === null && entryEditor()}
                      {!meta[tab].length && !entryEdit && <button type="button" className="ltr-paper-empty" onClick={() => { setEntryEdit({ id: null, title: "", content: "" }); setError(""); }}><Pencil size={24} /><span>{tab === "notes" ? "把沿途的思考写在这里" : tab === "resources" ? "让值得参考的资料有处可寻" : "每一个好想法，都值得留下"}</span><small>＋ {addLabel}</small></button>}
                    </div>
                      {tab === "notes" && !meta.notes.length && !entryEdit && <aside className="ltr-notebook-quote" aria-label="寄语"><p>一步一步，<br />靠近想要的生活。</p><svg className="ltr-paper-sprig" viewBox="0 0 90 120" fill="none" aria-hidden="true"><path d="M48 117C43 87 48 52 58 15M47 91C30 73 16 81 10 88C25 98 38 96 47 91ZM47 76C66 76 78 58 80 48C61 51 51 63 47 76ZM48 57C31 54 20 36 18 23C36 30 46 41 48 57ZM53 39C70 32 73 14 72 4C58 15 53 25 53 39Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></aside>}
                    </div>

                  </section>
                </div>
              </> : <p className="ltr-empty">请选择或新建一个长期计划</p>}
            </section>
          </div>
          </fieldset>
        </div>
      </div>
      {dailyPicker && createPortal(<div className="ltr-daily-picker" role="dialog" aria-label="加入今天的每日计划" style={{ left: dailyPicker.left, top: dailyPicker.top }}>
        <div className="ltr-picker-heading">加入今天 · 选择分组<button type="button" className="ltr-icon-action" aria-label="关闭分组选择" onClick={() => setDailyPicker(null)}><X size={15} /></button></div>
        {CATEGORIES.map(key => <button type="button" className="ltr-group-option" key={key} onClick={() => { if (addDaily(dailyPicker.title, key)) setDailyPicker(null); }}>{CATEGORY_META[key].label}</button>)}
      </div>, document.body)}
      <dialog ref={dialog} className="ltr-dialog" onCancel={event => { event.preventDefault(); setModal(null); }} onClick={event => { if (event.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setModal(null); } }}>
        {modal && <form onSubmit={event => { event.preventDefault(); submit(); }}>
          <div className="ltr-dialog-heading"><h2>{modal.kind === "compass" ? modal.title : modal.kind === "delete" ? "确认删除" : modal.kind === "daily" ? "加入 Daily Plan" : `${modal.id ? "编辑" : "新建"}${kindNames[modal.kind]}`}</h2><button type="button" aria-label="关闭弹窗" onClick={() => setModal(null)}><X size={20} /></button></div>
          {modal.kind === "compass" ? <label>内容<textarea aria-label="内容" autoFocus rows={8} placeholder="写下你的想法…" value={modal.content} onChange={event => setModal({ ...modal, content: event.target.value })} /></label> : modal.kind === "delete" ? <p>{modal.title}<br />{modal.content}</p> : modal.kind === "daily" ? <><p>{modal.title}</p><label>加入今天 · 选择分组<select aria-label="Daily Plan 分组" value={category} onChange={event => setCategory(event.target.value as Category)}>{CATEGORIES.map(key => <option key={key} value={key}>{CATEGORY_META[key].label}</option>)}</select></label></> : <><label>名称<input aria-label="名称" autoFocus required maxLength={100} value={modal.title} onChange={event => setModal({ ...modal, title: event.target.value })} /></label>{modal.kind !== "step" && <label>{modal.kind === "plan" ? "一句话目标" : modal.kind === "resources" ? "资料链接" : "内容"}{modal.kind === "resources" ? <input aria-label="资料链接" type="url" required value={modal.content} onChange={event => setModal({ ...modal, content: event.target.value })} /> : <textarea aria-label={modal.kind === "plan" ? "一句话目标" : "内容"} rows={modal.kind === "plan" ? 2 : 5} value={modal.content} onChange={event => setModal({ ...modal, content: event.target.value })} />}</label>}</>}
          {error && <p role="alert" className="is-danger">{error}</p>}
          <div className="ltr-dialog-actions"><button type="button" className="ltr-edit" onClick={() => setModal(null)}>取消</button><button type="submit" className="ltr-primary">{modal.kind === "delete" ? "确认删除" : modal.kind === "daily" ? "确认添加" : "保存"}</button></div>
        </form>}
      </dialog>
    </div>
  );
}
