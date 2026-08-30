const STORAGE_KEY = "plan-record-long-term-plans-demo-v1";
const PLAN_PALETTE = ["#C7DCCF", "#D8D1E6", "#F6E8B8", "#FFD8B5", "#DDAAA1", "#E6E2DD"];
const STACK_CARD_DURATION = 700;
const STACK_CARD_STAGGER = 36;
const BRIDGE_SOURCE = "plan-record-long-term-plans";

const seedProjects = [
  { id: "phd-application", name: "PhD Application", color: PLAN_PALETTE[0], tasks: [
    { id: "phd-1", title: "Shortlist research groups", done: true },
    { id: "phd-2", title: "Refine research proposal", done: true },
    { id: "phd-3", title: "Contact potential supervisors", done: false },
    { id: "phd-4", title: "Prepare application materials", done: false },
  ]},
  { id: "job-hunting", name: "Job Hunting", color: PLAN_PALETTE[1], tasks: [
    { id: "job-1", title: "Update CV and portfolio", done: true },
    { id: "job-2", title: "Create target company list", done: false },
    { id: "job-3", title: "Practice case interviews", done: false },
  ]},
  { id: "ai-agent-learning", name: "AI Agent Learning", color: PLAN_PALETTE[2], tasks: [
    { id: "ai-1", title: "Finish agent fundamentals course", done: true },
    { id: "ai-2", title: "Build a tool-calling prototype", done: true },
    { id: "ai-3", title: "Study memory and evaluation patterns", done: false },
    { id: "ai-4", title: "Publish a small agent project", done: false },
  ]},
];

const icons = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
};

let projects = loadProjects();
let folderOpen = false;
let activeProjectId = null;
let activeOrigin = null;
let editingTaskId = null;
let deleteArmedId = null;
let draggedProjectId = null;
let draggedTaskId = null;
let toastTimer = null;
let isAnimating = false;
let newProjectPanelTimer = null;

const stage = document.querySelector("#folder-entry-view");
const stack = document.querySelector("#card-stack");
const newProjectForm = document.querySelector("#new-project-form");
const newProjectName = document.querySelector("#new-project-name");

function cloneSeed() { return JSON.parse(JSON.stringify(seedProjects)); }
function uid(prefix) { return prefix === "project" ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function escapeHtml(value) { const node = document.createElement("div"); node.textContent = String(value); return node.innerHTML; }

function loadProjects() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : cloneSeed();
    if (!Array.isArray(parsed)) return cloneSeed();
    return parsed.map((project, index) => ({
      ...project,
      color: PLAN_PALETTE.includes(project.color) ? project.color : PLAN_PALETTE[index % PLAN_PALETTE.length],
      tasks: Array.isArray(project.tasks) ? project.tasks : [],
    }));
  } catch { return cloneSeed(); }
}

function saveProjects() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  updateFolder();
  if (window.parent !== window) {
    window.parent.postMessage({ source: BRIDGE_SOURCE, type: "projects-changed", projects }, window.location.origin);
  }
}

function applyExternalProjects(nextProjects) {
  if (!Array.isArray(nextProjects)) return;
  projects = nextProjects.map((project, index) => ({
    id: String(project.id || crypto.randomUUID()),
    name: String(project.name || "Untitled plan"),
    color: PLAN_PALETTE.includes(project.color) ? project.color : PLAN_PALETTE[index % PLAN_PALETTE.length],
    tasks: Array.isArray(project.tasks) ? project.tasks.map((task) => ({
      id: String(task.id || uid("step")),
      title: String(task.title || "Untitled step"),
      done: Boolean(task.done),
    })) : [],
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  activeProjectId = null;
  activeOrigin = null;
  editingTaskId = null;
  deleteArmedId = null;
  folderOpen = false;
  renderStack();
}

function stats(project) {
  const total = project.tasks.length;
  const done = project.tasks.filter((task) => task.done).length;
  return { total, done, progress: total ? Math.round((done / total) * 100) : 0 };
}

function updateFolder() {
  const fallbackColors = PLAN_PALETTE;
  for (let index = 0; index < 3; index += 1) {
    stage.style.setProperty(`--folder-card-${index + 1}`, projects[index]?.color || fallbackColors[index]);
  }
}

function renderStack(animateActive = false) {
  stage.classList.toggle("open", folderOpen);
  stage.classList.toggle("has-active", Boolean(activeProjectId));
  const maxStackRise = 176;
  const maxCardSpacing = 54;
  const spacing = projects.length > 1
    ? Math.min(maxCardSpacing, maxStackRise / (projects.length - 1))
    : 0;
  stage.style.setProperty("--stack-rise", `${spacing * Math.max(0, projects.length - 1)}px`);
  if (!projects.length) {
    stack.innerHTML = "";
    updateFolder();
    return;
  }

  stack.innerHTML = projects.map((project, index) => {
    const active = project.id === activeProjectId;
    // Plan 01 is the outer/front card; every new plan is appended behind it.
    const stackY = -spacing * index;
    const layer = projects.length - index + 2;
    const hoverTilt = projects.length > 1 ? -(40 - (38 * index) / (projects.length - 1)) : -20;
    const heroOrigin = active && activeOrigin
      ? `--hero-x:${activeOrigin.x}px;--hero-y:${activeOrigin.y}px;--hero-width:${activeOrigin.width}px;--hero-height:${activeOrigin.height}px;--return-height:${activeOrigin.fullHeight}px;`
      : "";
    const projectStats = stats(project);
    return `
      <article class="plan-card ${active ? `active ${animateActive ? "pending-active" : ""}` : ""} ${activeProjectId && !active ? "behind-active" : ""}"
        data-project-id="${project.id}" tabindex="${active || !folderOpen ? -1 : 0}" draggable="false"
        style="--layer:${layer};--stack-y:${stackY}px;--hover-tilt:${hoverTilt}deg;--open-delay:${index * STACK_CARD_STAGGER}ms;--close-delay:${index * STACK_CARD_STAGGER}ms;--card-color:${project.color};${heroOrigin}">
        <header class="card-header">
          ${active ? '<button class="close-dot close-project" type="button" aria-label="Put project back"></button>' : ""}
          <div class="card-heading">
            <span class="card-number">PLAN ${String(index + 1).padStart(2, "0")}</span>
            ${active && project.editingTitle ? editTitleTemplate(project) : `<h2>${escapeHtml(project.name)}</h2>`}
            <span class="card-preview"><span>${projectStats.progress}% complete</span><span class="card-preview-track"><i style="width:${projectStats.progress}%"></i></span></span>
          </div>
          <div class="card-header-actions">
            ${active && project.editingTitle ? "" : active ? `
              <button class="header-button edit-project" type="button" aria-label="Edit project title">${icons.edit}</button>
              <button class="header-button delete-project ${deleteArmedId === project.id ? "armed" : ""}" type="button" aria-label="${deleteArmedId === project.id ? "Confirm delete project" : "Delete project"}">${icons.trash}</button>
            ` : '<span class="card-grip" title="Drag to reorder" aria-hidden="true">⠿</span>'}
          </div>
        </header>
        <div class="card-progress">
          <div class="progress-copy"><span>${projectStats.done} of ${projectStats.total} steps complete</span><span>${projectStats.progress}%</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${projectStats.progress}%"></div></div>
        </div>
        <section class="card-content" aria-label="Project steps">
          <p class="section-label">NEXT STEPS</p>
          ${project.tasks.length ? `<div class="task-list">${project.tasks.map((task) => taskTemplate(task, active)).join("")}</div>` : '<p class="empty-tasks">No steps yet. Add the first one below.</p>'}
        </section>
        <form class="card-footer" data-add-step>
          <input type="text" maxlength="100" placeholder="Add a next step…" autocomplete="off" aria-label="New step" />
          <button type="submit">Add step</button>
        </form>
      </article>`;
  }).join("");

  bindStackEvents();
  updateFolder();
}

function editTitleTemplate(project) {
  return `
    <div class="inline-title-edit">
      <input class="edit-title-input" type="text" maxlength="60" value="${escapeHtml(project.name)}" aria-label="Project title" />
      <div class="edit-title-actions">
        <button class="save-title" type="button">Save</button>
        <button class="cancel cancel-title" type="button">Cancel</button>
      </div>
    </div>`;
}

function taskTemplate(task, active) {
  if (active && task.id === editingTaskId) {
    return `
      <div class="task-row editing ${task.done ? "done" : ""}" data-task-id="${task.id}">
        <span class="task-grip" aria-hidden="true">⠿</span>
        <input class="task-check" type="checkbox" ${task.done ? "checked" : ""} aria-label="Mark ${escapeHtml(task.title)} ${task.done ? "incomplete" : "complete"}" />
        <input class="edit-task-input" type="text" maxlength="100" value="${escapeHtml(task.title)}" aria-label="Step title" />
        <span class="task-actions">
          <button class="task-button save-task" type="button" aria-label="Save step">${icons.check}</button>
          <button class="task-button cancel-task" type="button" aria-label="Cancel editing">${icons.close}</button>
        </span>
      </div>`;
  }
  return `
    <div class="task-row ${task.done ? "done" : ""}" data-task-id="${task.id}" draggable="${active}">
      <span class="task-grip" aria-hidden="true">⠿</span>
      <input class="task-check" type="checkbox" ${task.done ? "checked" : ""} ${active ? "" : "disabled"} aria-label="Mark ${escapeHtml(task.title)} ${task.done ? "incomplete" : "complete"}" />
      <span class="task-label">${escapeHtml(task.title)}</span>
      <span class="task-actions">
        <button class="task-button edit-task" type="button" aria-label="Edit step">${icons.edit}</button>
        <button class="task-button danger delete-task" type="button" aria-label="Delete step">${icons.trash}</button>
      </span>
    </div>`;
}

function bindStackEvents() {
  stack.querySelectorAll(".plan-card").forEach((card) => {
    const project = projects.find((item) => item.id === card.dataset.projectId);
    const active = project.id === activeProjectId;

    if (!active) {
      const open = () => {
        if (!folderOpen || activeProjectId || draggedProjectId || isAnimating) return;
        const cardRect = card.getBoundingClientRect();
        const headerRect = card.querySelector(".card-header").getBoundingClientRect();
        const stackRect = stack.getBoundingClientRect();
        const hoverOffset = card.matches(":hover") ? 8 : 0;
        activeOrigin = {
          x: cardRect.left + cardRect.width / 2 - stackRect.left,
          y: cardRect.top - stackRect.top + hoverOffset,
          width: cardRect.width,
          height: Math.max(58, Math.min(76, headerRect.height)),
          fullHeight: cardRect.height,
        };
        isAnimating = true;
        activeProjectId = project.id;
        editingTaskId = null;
        deleteArmedId = null;
        renderStack(true);
        window.setTimeout(() => {
          stack.querySelector(".pending-active")?.classList.remove("pending-active");
          isAnimating = false;
          stack.querySelector(".close-project")?.focus();
        }, 680);
      };
      card.addEventListener("click", open);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      });
      return;
    }

    card.querySelector(".close-project").addEventListener("click", () => closeActiveProject(project, card));

    const editProjectButton = card.querySelector(".edit-project");
    if (editProjectButton) {
      editProjectButton.addEventListener("click", () => {
        project.editingTitle = true;
        renderStack();
        const refreshedCard = stack.querySelector(".plan-card.active");
        const input = refreshedCard.querySelector(".edit-title-input");
        input.focus();
        input.select();
      });
    }

    const deleteProjectButton = card.querySelector(".delete-project");
    if (deleteProjectButton) {
      deleteProjectButton.addEventListener("click", () => {
        if (deleteArmedId !== project.id) {
          deleteArmedId = project.id;
          renderStack();
          showToast("Click delete again to confirm");
          return;
        }
        projects = projects.filter((item) => item.id !== project.id);
        activeProjectId = null;
        activeOrigin = null;
        deleteArmedId = null;
        saveProjects();
        renderStack();
        showToast("Plan deleted");
      });
    }

    if (project.editingTitle) bindTitleEdit(project, card);

    card.querySelector("[data-add-step]").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = event.currentTarget.querySelector("input");
      const title = input.value.trim();
      if (!title) return input.focus();
      project.tasks.push({ id: uid("step"), title, done: false });
      saveProjects();
      renderStack();
      showToast("Step added");
    });

    card.querySelectorAll(".task-row").forEach((row) => bindTaskEvents(project, row));
  });
}

function closeActiveProject(project, card) {
  if (isAnimating) return;
  isAnimating = true;
  project.editingTitle = false;
  editingTaskId = null;
  deleteArmedId = null;
  stage.classList.add("returning-active");
  stage.classList.remove("has-active");
  card.classList.add("returning");
  window.setTimeout(() => {
    activeProjectId = null;
    activeOrigin = null;
    stage.classList.remove("returning-active");
    isAnimating = false;
    renderStack();
    stack.querySelector(`[data-project-id="${project.id}"]`)?.focus();
  }, 760);
}

function bindTitleEdit(project, card) {
  const input = card.querySelector(".edit-title-input");
  const save = () => {
    const name = input.value.trim();
    if (!name) return input.focus();
    project.name = name;
    project.editingTitle = false;
    saveProjects();
    renderStack();
    showToast("Plan updated");
  };
  card.querySelector(".save-title").addEventListener("click", save);
  card.querySelector(".cancel-title").addEventListener("click", () => { project.editingTitle = false; renderStack(); });
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") save(); });
}

function bindProjectDrag(card) {
  card.addEventListener("dragstart", (event) => {
    draggedProjectId = card.dataset.projectId;
    event.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    window.setTimeout(() => { draggedProjectId = null; }, 0);
  });
  card.addEventListener("dragover", (event) => {
    if (!draggedProjectId || draggedProjectId === card.dataset.projectId) return;
    event.preventDefault();
    card.classList.add("drag-over");
  });
  card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
  card.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const from = projects.findIndex((item) => item.id === draggedProjectId);
    const to = projects.findIndex((item) => item.id === card.dataset.projectId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = projects.splice(from, 1);
    projects.splice(to, 0, moved);
    saveProjects();
    renderStack();
    showToast("Plans reordered");
  });
}

function bindTaskEvents(project, row) {
  const task = project.tasks.find((item) => item.id === row.dataset.taskId);
  if (row.classList.contains("editing")) {
    const input = row.querySelector(".edit-task-input");
    row.querySelector(".task-check").addEventListener("change", (event) => {
      task.done = event.target.checked;
      saveProjects();
    });
    const save = () => {
      const title = input.value.trim();
      if (!title) return input.focus();
      task.title = title;
      editingTaskId = null;
      saveProjects();
      renderStack();
      showToast("Step updated");
    };
    row.querySelector(".save-task").addEventListener("click", save);
    row.querySelector(".cancel-task").addEventListener("click", () => { editingTaskId = null; renderStack(); });
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") save(); });
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
    return;
  }

  row.querySelector(".task-check").addEventListener("change", (event) => {
    task.done = event.target.checked;
    saveProjects();
    renderStack();
  });
  row.querySelector(".edit-task").addEventListener("click", () => { editingTaskId = task.id; renderStack(); });
  row.querySelector(".delete-task").addEventListener("click", () => {
    project.tasks = project.tasks.filter((item) => item.id !== task.id);
    saveProjects();
    renderStack();
    showToast("Step deleted");
  });
  row.addEventListener("dragstart", (event) => {
    event.stopPropagation();
    draggedTaskId = task.id;
    event.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
  });
  row.addEventListener("dragend", () => { draggedTaskId = null; row.classList.remove("dragging"); });
  row.addEventListener("dragover", (event) => {
    if (!draggedTaskId || draggedTaskId === task.id) return;
    event.preventDefault();
    row.classList.add("drag-over");
  });
  row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    const from = project.tasks.findIndex((item) => item.id === draggedTaskId);
    const to = project.tasks.findIndex((item) => item.id === task.id);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = project.tasks.splice(from, 1);
    project.tasks.splice(to, 0, moved);
    saveProjects();
    renderStack();
    showToast("Steps reordered");
  });
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1500);
}

function openNewProjectPanel() {
  clearTimeout(newProjectPanelTimer);
  newProjectForm.hidden = false;
  newProjectName.value = "";
  const defaultColor = PLAN_PALETTE[projects.length % PLAN_PALETTE.length];
  newProjectForm.querySelectorAll('[name="new-project-color"]').forEach((input) => {
    input.checked = input.value === defaultColor;
  });
  window.requestAnimationFrame(() => {
    newProjectForm.classList.add("visible");
    newProjectName.focus();
  });
}

function closeNewProjectPanel(restoreFocus = true) {
  clearTimeout(newProjectPanelTimer);
  newProjectForm.classList.remove("visible");
  newProjectPanelTimer = window.setTimeout(() => {
    newProjectForm.hidden = true;
    if (restoreFocus && folderOpen && !activeProjectId) document.querySelector("#add-project").focus();
  }, 280);
}

function closeFolderCards() {
  if (!folderOpen || activeProjectId || isAnimating) return;
  isAnimating = true;
  folderOpen = false;
  if (!newProjectForm.hidden) closeNewProjectPanel(false);
  stage.classList.add("closing");
  stage.classList.remove("open");
  stack.querySelectorAll(".plan-card").forEach((card) => { card.tabIndex = -1; });
  const duration = STACK_CARD_DURATION + Math.max(0, projects.length - 1) * STACK_CARD_STAGGER;
  window.setTimeout(() => {
    stage.classList.remove("closing");
    isAnimating = false;
    document.querySelector("#open-folder").focus();
  }, duration);
}

document.querySelector("#add-project").addEventListener("click", (event) => {
  event.stopPropagation();
  if (!folderOpen || activeProjectId || isAnimating) return;
  if (!newProjectForm.hidden) return newProjectName.focus();
  openNewProjectPanel();
});
document.querySelector("#cancel-project").addEventListener("click", () => closeNewProjectPanel());
document.querySelector("#open-folder").addEventListener("click", (event) => {
  if (event.target.closest(".plan-card")) return;
  if (isAnimating) return;
  if (folderOpen && !activeProjectId) {
    closeFolderCards();
    return;
  }
  isAnimating = true;
  folderOpen = true;
  stage.classList.remove("closing");
  window.requestAnimationFrame(() => {
    stage.classList.add("open");
    stack.querySelectorAll(".plan-card").forEach((card) => { card.tabIndex = 0; });
    const duration = STACK_CARD_DURATION + Math.max(0, projects.length - 1) * STACK_CARD_STAGGER;
    window.setTimeout(() => {
      isAnimating = false;
      stack.querySelector(".plan-card:first-child")?.focus();
    }, duration);
  });
});
document.querySelector("#open-folder").addEventListener("keydown", (event) => {
  if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  event.currentTarget.click();
});
newProjectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = newProjectName.value.trim();
  if (!name) return newProjectName.focus();
  const selectedColor = new FormData(newProjectForm).get("new-project-color");
  const color = PLAN_PALETTE.includes(selectedColor) ? selectedColor : PLAN_PALETTE[projects.length % PLAN_PALETTE.length];
  projects.push({ id: uid("project"), name, color, tasks: [] });
  closeNewProjectPanel();
  saveProjects();
  renderStack();
  showToast("New plan inserted");
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!newProjectForm.hidden) closeNewProjectPanel();
  else if (activeProjectId) {
    const project = projects.find((item) => item.id === activeProjectId);
    const card = stack.querySelector(".plan-card.active");
    if (project && card) closeActiveProject(project, card);
  }
  else if (folderOpen) {
    closeFolderCards();
  }
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin || event.data?.source !== BRIDGE_SOURCE) return;
  if (event.data.type === "set-projects") applyExternalProjects(event.data.projects);
  if (event.data.type === "request-projects" && window.parent !== window) {
    window.parent.postMessage({ source: BRIDGE_SOURCE, type: "ready", projects }, window.location.origin);
  }
});

renderStack();
if (window.parent !== window) {
  window.parent.postMessage({ source: BRIDGE_SOURCE, type: "ready", projects }, window.location.origin);
}
