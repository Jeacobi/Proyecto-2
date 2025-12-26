const STORAGE_KEY = "daily_tasks_v1";

function pad2(n){
  return String(n).padStart(2, "0");
}

function formatDateISO(date){
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

function formatDateHuman(iso){
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const fmt = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "2-digit", month: "short" });
  return fmt.format(dt);
}

function uid(){
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParse(json, fallback){
  try{
    const v = JSON.parse(json);
    return v ?? fallback;
  }catch{
    return fallback;
  }
}

function loadTasks(){
  const raw = localStorage.getItem(STORAGE_KEY);
  const tasks = safeParse(raw, []);
  if (!Array.isArray(tasks)) return [];
  return tasks.filter(t => t && typeof t === "object");
}

function saveTasks(tasks){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

const els = {
  todayChip: document.getElementById("todayChip"),
  addForm: document.getElementById("addForm"),
  taskTitle: document.getElementById("taskTitle"),
  taskDate: document.getElementById("taskDate"),
  taskPriority: document.getElementById("taskPriority"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  segmentedBtns: Array.from(document.querySelectorAll(".segmented__btn")),
  stats: document.getElementById("stats"),
  taskList: document.getElementById("taskList"),
  emptyState: document.getElementById("emptyState"),
  clearCompletedBtn: document.getElementById("clearCompletedBtn"),
  resetBtn: document.getElementById("resetBtn"),
};

const state = {
  tasks: [],
  filter: "all",
  search: "",
  sort: "dateDesc",
};

function priorityLabel(p){
  if (p === "high") return "Alta";
  if (p === "medium") return "Media";
  return "Baja";
}

function compareBySort(sort){
  if (sort === "dateAsc"){
    return (a,b) => (a.date || "").localeCompare(b.date || "") || (b.createdAt - a.createdAt);
  }
  if (sort === "dateDesc"){
    return (a,b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt - a.createdAt);
  }
  if (sort === "priorityDesc"){
    const rank = { high: 3, medium: 2, low: 1 };
    return (a,b) => (rank[b.priority] - rank[a.priority]) || (b.createdAt - a.createdAt);
  }
  if (sort === "createdDesc"){
    return (a,b) => (b.createdAt - a.createdAt);
  }
  return (a,b) => (b.createdAt - a.createdAt);
}

function computeVisibleTasks(){
  const today = formatDateISO(new Date());
  const q = state.search.trim().toLowerCase();

  return state.tasks
    .filter(t => {
      if (state.filter === "today") return t.date === today;
      if (state.filter === "pending") return !t.completed;
      if (state.filter === "completed") return !!t.completed;
      return true;
    })
    .filter(t => {
      if (!q) return true;
      return (t.title || "").toLowerCase().includes(q);
    })
    .slice()
    .sort(compareBySort(state.sort));
}

function setSegmentedSelected(filter){
  for (const btn of els.segmentedBtns){
    const selected = btn.dataset.filter === filter;
    btn.setAttribute("aria-selected", selected ? "true" : "false");
  }
}

function iconSvg(name){
  if (name === "check"){
    return "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 6L9 17l-5-5\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>";
  }
  if (name === "edit"){
    return "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 20h9\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>";
  }
  if (name === "trash"){
    return "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 6h18\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M8 6V4h8v2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M19 6l-1 14H6L5 6\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M10 11v6M14 11v6\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>";
  }
  if (name === "x"){
    return "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M18 6 6 18\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M6 6l12 12\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>";
  }
  if (name === "save"){
    return "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M17 21v-8H7v8\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>";
  }
  return "";
}

function render(){
  const visible = computeVisibleTasks();

  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.completed).length;
  const pending = total - done;

  const today = formatDateISO(new Date());
  const todayCount = state.tasks.filter(t => t.date === today).length;

  els.stats.textContent = `Total: ${total} · Pendientes: ${pending} · Hechas: ${done} · Hoy: ${todayCount}`;

  els.taskList.innerHTML = "";

  if (visible.length === 0){
    els.emptyState.hidden = false;
  } else {
    els.emptyState.hidden = true;
  }

  for (const task of visible){
    const li = document.createElement("li");
    li.className = "item";
    li.dataset.id = task.id;
    li.dataset.editing = task.editing ? "true" : "false";

    const check = document.createElement("button");
    check.type = "button";
    check.className = "check";
    check.setAttribute("aria-label", task.completed ? "Marcar como pendiente" : "Marcar como hecha");
    check.dataset.checked = task.completed ? "true" : "false";
    check.innerHTML = task.completed ? iconSvg("check") : "";

    const main = document.createElement("div");
    main.className = "main";

    const titleRow = document.createElement("div");
    titleRow.className = "titleRow";

    const title = document.createElement("div");
    title.className = "taskTitle" + (task.completed ? " isDone" : "");
    title.textContent = task.title;
    title.title = "Doble click para editar";

    const badges = document.createElement("div");
    badges.className = "badges";

    const dateBadge = document.createElement("span");
    dateBadge.className = "badge";
    dateBadge.textContent = formatDateHuman(task.date);

    const priorityBadge = document.createElement("span");
    priorityBadge.className = `badge badge--${task.priority}`;
    priorityBadge.textContent = `Prioridad: ${priorityLabel(task.priority)}`;

    badges.appendChild(dateBadge);
    badges.appendChild(priorityBadge);

    titleRow.appendChild(title);

    const editBox = document.createElement("div");
    editBox.className = "editBox";

    const editInput = document.createElement("input");
    editInput.className = "input editInput";
    editInput.type = "text";
    editInput.value = task.title;
    editInput.maxLength = 120;
    editInput.setAttribute("aria-label", "Editar título");

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "iconBtn";
    saveBtn.setAttribute("aria-label", "Guardar");
    saveBtn.innerHTML = iconSvg("save");

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "iconBtn";
    cancelBtn.setAttribute("aria-label", "Cancelar");
    cancelBtn.innerHTML = iconSvg("x");

    editBox.appendChild(editInput);
    editBox.appendChild(saveBtn);
    editBox.appendChild(cancelBtn);

    main.appendChild(titleRow);
    main.appendChild(editBox);
    main.appendChild(badges);

    const actions = document.createElement("div");
    actions.className = "actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "iconBtn";
    editBtn.setAttribute("aria-label", "Editar");
    editBtn.innerHTML = iconSvg("edit");

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "iconBtn iconBtn--danger";
    delBtn.setAttribute("aria-label", "Eliminar");
    delBtn.innerHTML = iconSvg("trash");

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    check.addEventListener("click", () => toggleCompleted(task.id));
    delBtn.addEventListener("click", () => removeTask(task.id));
    editBtn.addEventListener("click", () => startEdit(task.id));
    title.addEventListener("dblclick", () => startEdit(task.id));

    const commitEdit = () => {
      const nextTitle = editInput.value.trim();
      if (!nextTitle){
        cancelEdit(task.id);
        return;
      }
      updateTaskTitle(task.id, nextTitle);
    };

    saveBtn.addEventListener("click", commitEdit);
    cancelBtn.addEventListener("click", () => cancelEdit(task.id));
    editInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commitEdit();
      if (e.key === "Escape") cancelEdit(task.id);
    });

    li.appendChild(check);
    li.appendChild(main);
    li.appendChild(actions);

    els.taskList.appendChild(li);

    if (task.editing){
      queueMicrotask(() => {
        editInput.focus();
        editInput.select();
      });
    }
  }

  const anyCompleted = state.tasks.some(t => t.completed);
  els.clearCompletedBtn.disabled = !anyCompleted;
  els.clearCompletedBtn.style.opacity = anyCompleted ? "1" : ".55";
}

function addTask({title, date, priority}){
  const task = {
    id: uid(),
    title,
    date,
    priority,
    completed: false,
    createdAt: Date.now(),
  };

  state.tasks.unshift(task);
  saveTasks(state.tasks);
  render();
}

function toggleCompleted(id){
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  saveTasks(state.tasks);
  render();
}

function removeTask(id){
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveTasks(state.tasks);
  render();
}

function startEdit(id){
  for (const t of state.tasks){
    t.editing = t.id === id;
  }
  render();
}

function cancelEdit(id){
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  delete t.editing;
  render();
}

function updateTaskTitle(id, nextTitle){
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.title = nextTitle;
  delete t.editing;
  saveTasks(state.tasks);
  render();
}

function clearCompleted(){
  state.tasks = state.tasks.filter(t => !t.completed);
  saveTasks(state.tasks);
  render();
}

function resetAll(){
  state.tasks = [];
  saveTasks(state.tasks);
  render();
}

function init(){
  const now = new Date();
  const todayIso = formatDateISO(now);

  els.todayChip.textContent = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(now);

  els.taskDate.value = todayIso;

  state.tasks = loadTasks().map(t => {
    const date = typeof t.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayIso;
    const priority = (t.priority === "high" || t.priority === "medium" || t.priority === "low") ? t.priority : "medium";
    return {
      id: typeof t.id === "string" ? t.id : uid(),
      title: String(t.title ?? "").slice(0, 120) || "(Sin título)",
      date,
      priority,
      completed: !!t.completed,
      createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
    };
  });

  els.addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = els.taskTitle.value.trim();
    const date = els.taskDate.value;
    const priority = els.taskPriority.value;

    if (!title) return;
    if (!date) return;

    addTask({ title, date, priority });
    els.taskTitle.value = "";
    els.taskTitle.focus();
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value;
    render();
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    render();
  });

  for (const btn of els.segmentedBtns){
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      setSegmentedSelected(state.filter);
      render();
    });
  }

  els.clearCompletedBtn.addEventListener("click", clearCompleted);

  els.resetBtn.addEventListener("click", () => {
    const ok = confirm("Esto borrará TODAS las tareas. ¿Continuar?");
    if (!ok) return;
    resetAll();
  });

  state.filter = "all";
  setSegmentedSelected(state.filter);
  state.sort = els.sortSelect.value;
  render();
}

init();
