/* Макет: переключение экранов, темы и простые реакции на действия. Без зависимостей. */
(function () {
  "use strict";
  var qs = new URLSearchParams(location.search);
  var root = document.documentElement;
  var screens = Array.prototype.slice.call(document.querySelectorAll(".screen"));
  var THEME_KEY = "reprep-mockup-theme";

  /* ---------- Тема ---------- */
  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function setTheme(theme, remember) {
    root.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-theme-set]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-theme-set") === theme));
    });
    if (remember) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* file:// без хранилища */ } }
  }
  var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(qs.get("theme") || storedTheme() || (systemDark ? "dark" : "light"), false);
  document.querySelectorAll("[data-theme-set]").forEach(function (b) {
    b.addEventListener("click", function () { setTheme(b.getAttribute("data-theme-set"), true); });
  });

  if (qs.has("shot")) document.body.classList.add("shot");
  if (qs.has("gallery")) document.body.classList.add("gallery");

  /* ---------- Экраны ---------- */
  function show(id, push) {
    var target = document.getElementById(id);
    if (!target || !target.classList.contains("screen")) { id = screens[0].id; target = screens[0]; }
    screens.forEach(function (s) { s.classList.toggle("active", s === target); });
    document.querySelectorAll(".rail nav a[href^='#']").forEach(function (a) {
      if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    var sc = target.querySelector(".scroll");
    if (sc) sc.scrollTop = 0;
    if (id === "l-sent") replay(target);
    if (id === "l-check") {
      /* «Перед отправкой» показывает то, что ученик действительно ввёл */
      var answers = target.querySelectorAll(".ans");
      var chosen = document.querySelector("#l-task-2 .option[aria-checked='true']");
      var values = [document.getElementById("ans1").value.trim(), chosen ? chosen.lastChild.textContent.trim() : "", document.getElementById("ans3").value.trim()];
      values.forEach(function (v, i) { if (v && answers[i]) answers[i].textContent = v; });
    }
    if (push) history.pushState({ id: id }, "", location.search + "#" + id);
    document.title = (target.getAttribute("data-title") || "RePrep") + " — макет";
  }
  function replay(el) {
    el.querySelectorAll(".burst span, .burst .core").forEach(function (n) {
      n.style.animation = "none"; void n.offsetWidth; n.style.animation = "";
    });
  }
  function afterSend(on) {
    document.body.classList.toggle("after-send", on);
    try { on ? sessionStorage.setItem("reprep-mockup-sent", "1") : sessionStorage.removeItem("reprep-mockup-sent"); } catch (e) { /* без хранилища */ }
  }
  try { if (sessionStorage.getItem("reprep-mockup-sent") && !qs.has("shot")) document.body.classList.add("after-send"); } catch (e) { /* без хранилища */ }
  if (qs.get("home") === "after") document.body.classList.add("after-send");

  document.addEventListener("click", function (e) {
    var link = e.target.closest("a[href^='#']");
    if (link && link.hasAttribute("data-after-send")) afterSend(true);
    if (link && link.hasAttribute("data-reset-send")) afterSend(false);
    if (link && !link.hasAttribute("data-plain")) {
      e.preventDefault();
      var id = link.getAttribute("href").slice(1);
      if (link.hasAttribute("data-toast")) return toast(link.getAttribute("data-toast"));
      show(id, true);
      return;
    }
    var go = e.target.closest("[data-go]");
    if (go && !go.disabled) { show(go.getAttribute("data-go"), true); return; }
    var t = e.target.closest("[data-toast]");
    if (t) toast(t.getAttribute("data-toast"));
  });
  window.addEventListener("popstate", function () { show(location.hash.slice(1) || "l-home", false); });

  /* ---------- Всплывающая подсказка «в макете не нарисовано» ---------- */
  var toastEl;
  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.setAttribute("role", "status");
      toastEl.style.cssText = "position:absolute;left:16px;right:16px;bottom:96px;padding:12px 16px;border-radius:14px;background:var(--ink);color:var(--bg);font-weight:700;font-size:15px;z-index:5;text-align:center";
      document.getElementById("app").appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }

  /* ---------- Реакции на ввод: мгновенно, но без оценки «верно/неверно» ---------- */
  function markSaved(scope) {
    var s = scope.querySelector(".saved");
    if (!s) return;
    s.innerHTML = "";
    clearTimeout(s._t);
    s._t = setTimeout(function () {
      s.innerHTML = '<svg class="icon"><use href="#i-check"/></svg>Сохранено';
    }, 450);
  }
  function footerButton(scope) { return scope.querySelector(".footer [data-go]"); }

  document.querySelectorAll("input.answer[data-kind='number']").forEach(function (input) {
    var scope = input.closest(".screen");
    var nudge = scope.querySelector(".nudge");
    function check() {
      var v = input.value.trim();
      var ok = /^[-−]?\d+([.,]\d+)?$/.test(v);
      var bad = v !== "" && !ok;
      input.classList.toggle("invalid", bad);
      input.setAttribute("aria-invalid", String(bad));
      nudge.classList.toggle("show", bad);
      footerButton(scope).disabled = !ok;
      if (ok) markSaved(scope); else scope.querySelector(".saved").innerHTML = "";
    }
    input.addEventListener("input", check);
    input._check = check;
  });
  document.querySelectorAll("textarea.answer").forEach(function (ta) {
    var scope = ta.closest(".screen");
    function check() {
      var ok = ta.value.trim().length >= 3;
      footerButton(scope).disabled = !ok;
      if (ok) markSaved(scope);
    }
    ta.addEventListener("input", check);
    ta._check = check;
  });
  document.querySelectorAll(".options").forEach(function (group) {
    var scope = group.closest(".screen");
    group.querySelectorAll(".option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        group.querySelectorAll(".option").forEach(function (o) { o.setAttribute("aria-checked", String(o === opt)); });
        footerButton(scope).disabled = false;
        markSaved(scope);
      });
    });
  });
  document.querySelectorAll(".hint-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var body = document.getElementById(btn.getAttribute("aria-controls"));
      var open = !body.classList.contains("show");
      body.classList.toggle("show", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  /* Кнопки, чьи экраны в макет не входят */
  [["#t-queue .btn", "Откроется работа Кати — экран проверки в макет не входит"],
   ["#l-review .btn.ghost", "Откроется обсуждение этой работы с Алексом"],
   [".attach", "Выбор файла .txt — в макете не подключён"],
   ["#t-queue .tabbar a:not([aria-current])", "В макете нарисован только экран проверки"],
   [".tabbar a[href='#l-home']:last-child", "Профиль в макет не входит"],
   ["#t-queue .chip", "Фильтр — в макете не переключается"],
   ["#p-summary .icon-btn, #t-queue .icon-btn", "Меню — в макете не нарисовано"],
   [".path .dot", "Здесь откроются работы по навыку"]
  ].forEach(function (pair) {
    document.querySelectorAll(pair[0]).forEach(function (el) { el.setAttribute("data-toast", pair[1]); });
  });

  /* ---------- Состояния для снимков: ?state=filled|invalid|hint ---------- */
  function fill(state) {
    var a1 = document.getElementById("ans1");
    if (state === "invalid") a1.value = "x = восемь";
    else a1.value = "2";
    a1._check();
    var t = document.getElementById("ans3");
    t.value = "Чтобы равенство сохранилось: с обеих сторон делаем одно и то же.";
    t._check();
    var o = document.querySelector("#l-task-2 .option[data-filled]");
    o.click();
    if (state === "hint") document.querySelector("#l-task-1 .hint-toggle").click();
    document.querySelectorAll(".saved").forEach(function (s) {
      clearTimeout(s._t);
      if (!s.closest(".screen").querySelector(".answer.invalid")) s.innerHTML = '<svg class="icon"><use href="#i-check"/></svg>Сохранено';
    });
  }
  var state = qs.get("state") || (qs.has("gallery") ? "filled" : null);
  if (state) fill(state);

  show(qs.get("screen") || location.hash.slice(1) || "l-home", false);
})();
