import { auth, db } from './firebase-config.js';
import { GoogleAuthProvider, signInWithCredential, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, enableIndexedDbPersistence } from 'firebase/firestore';

// --- State Management ---
function escapeHTML(str) {
  if (typeof str !== 'string') return String(str);
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

let currentUser = null;
let unsubscribeSnapshot = null;

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Firebase Offline Persistence Error:", err.code);
});

let state = {
  currentProfile: "home",
  userName: "Developer",
  userRole: "Full Stack Developer",
  searchEngine: "google",
  editMode: false,
  quoteIndex: 0,
  notes: "",
  currentBookmarkFolder: null,
  profiles: {
    home: {
      links: [
        {
          name: "Google",
          url: "https://google.com",
          icon: "https://www.google.com/favicon.ico",
        },
        {
          name: "YouTube",
          url: "https://youtube.com",
          icon: "https://www.youtube.com/favicon.ico",
        },
        {
          name: "GitHub",
          url: "https://github.com",
          icon: "https://github.com/favicon.ico",
        },
        {
          name: "ChatGPT",
          url: "https://chat.openai.com",
          icon: "https://chat.openai.com/favicon.ico",
        },
        {
          name: "Gmail",
          url: "https://mail.google.com",
          icon: "https://ssl.gstatic.com/ui/v1/icons/mail/images/2/favicon.ico",
        },
        {
          name: "Notion",
          url: "https://notion.so",
          icon: "https://www.notion.so/images/favicon.ico",
        },
      ],
      events: [
        {
          id: 1,
          title: "React Project Deadline",
          date: "2024-05-21",
          time: "10:00",
          color: "bg-indigo-500",
        },
        {
          id: 2,
          title: "System Design Meeting",
          date: "2024-05-22",
          time: "14:00",
          color: "bg-yellow-500",
        },
      ],
      projects: [
        {
          id: 1,
          name: "Dev Portfolio",
          stack: "Next.js • Tailwind CSS",
          progress: 70,
        },
        {
          id: 2,
          name: "Task Manager App",
          stack: "MERN Stack",
          progress: 40,
        },
        {
          id: 3,
          name: "AI Chat App",
          stack: "Next.js • OpenAI API",
          progress: 85,
        },
      ],
      todos: [
        { id: 1, text: "Finish MERN Project", done: false },
        { id: 2, text: "DSA Practice", done: true },
        { id: 3, text: "Read System Design Book", done: false },
      ],
      bookmarks: [
        {
          name: "Full Stack Development",
          links: [
            {
              title: "MDN Web Docs",
              url: "https://developer.mozilla.org",
            },
            { title: "React Docs", url: "https://react.dev" },
          ],
        },
        {
          name: "UI/UX Inspiration",
          links: [
            { title: "Dribbble", url: "https://dribbble.com" },
            { title: "Behance", url: "https://behance.net" },
          ],
        },
        { name: "Docs & References", links: [] },
        { name: "Interview Preparation", links: [] },
      ],
    },
    work: {
      links: [
        {
          name: "Slack",
          url: "https://slack.com",
          icon: "https://www.slack.com/favicon.ico",
        },
        {
          name: "Jira",
          url: "https://jira.com",
          icon: "https://www.jira.com/favicon.ico",
        },
      ],
      events: [],
      projects: [],
      todos: [],
      bookmarks: [],
    },
    dev: {
      links: [
        {
          name: "VS Code",
          url: "https://code.visualstudio.com",
          icon: "https://code.visualstudio.com/favicon.ico",
        },
        {
          name: "MDN Docs",
          url: "https://developer.mozilla.org",
          icon: "https://developer.mozilla.org/favicon.ico",
        },
      ],
      events: [],
      projects: [],
      todos: [],
      bookmarks: [],
    },
    learning: {
      links: [
        {
          name: "Udemy",
          url: "https://udemy.com",
          icon: "https://www.udemy.com/favicon.ico",
        },
        {
          name: "Coursera",
          url: "https://coursera.org",
          icon: "https://www.coursera.org/favicon.ico",
        },
      ],
      events: [],
      projects: [],
      todos: [],
      bookmarks: [],
    },
  },
};

const quotes = [
  {
    text: "The best way to predict the future is to create it.",
    author: "Peter Drucker",
  },
  {
    text: "Code is like humor. When you have to explain it, it's bad.",
    author: "Cory House",
  },
  {
    text: "First, solve the problem. Then, write the code.",
    author: "John Johnson",
  },
  {
    text: "Experience is the name everyone gives to their mistakes.",
    author: "Oscar Wilde",
  },
  {
    text: "In order to be irreplaceable, one must always be different.",
    author: "Coco Chanel",
  },
  {
    text: "Java is to JavaScript what car is to Carpet.",
    author: "Chris Heilmann",
  },
  { text: "Knowledge is power.", author: "Francis Bacon" },
  {
    text: "Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday's code.",
    author: "Dan Salomon",
  },
  {
    text: "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.",
    author: "Antoine de Saint-Exupéry",
  },
  {
    text: "Ruby is rubbish! PHP is phpantastic!",
    author: "Nikita Popov",
  },
];

// --- Initialization ---
function init() {
  loadState();
  updateTime();
  updateGreeting();
  renderProfile();
  setupSearch();
  fetchWeather();
  lucide.createIcons();
  renderQuote();
  setupAuth();

  // Handle image load errors (replaces inline onerror handlers blocked by MV3 CSP)
  document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG' && e.target.dataset.fallback) {
      e.target.src = e.target.dataset.fallback;
      e.target.removeAttribute('data-fallback'); // prevent infinite loop
    }
  }, true);

  setInterval(updateTime, 60000);
  setInterval(fetchWeather, 1800000);
  setInterval(lucide.createIcons, 5000);
}

function loadState() {
  const saved = localStorage.getItem("devflow_state");
  if (saved) {
    state = JSON.parse(saved);
    state.editMode = false;
  }
}

async function saveState() {
  localStorage.setItem("devflow_state", JSON.stringify(state));
  if (currentUser) {
    try {
      await setDoc(doc(db, "users", currentUser.uid), state);
    } catch (e) {
      console.error("Error syncing to cloud:", e);
    }
  }
}

// --- Firebase Auth & Sync ---
function setupAuth() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      document.getElementById('logged-in-view').classList.remove('hidden');
      document.getElementById('logged-in-view').classList.add('flex');
      document.getElementById('logged-out-view').classList.add('hidden');
      
      document.getElementById('auth-avatar').src = user.photoURL || '';
      document.getElementById('auth-name').textContent = user.displayName || 'User';
      document.getElementById('auth-email').textContent = user.email || '';
      
      if (user.displayName && state.userName !== user.displayName) {
        state.userName = user.displayName;
        saveState();
      }
      updateGreeting();

      // Sync cloud state to local
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeSnapshot = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const cloudState = docSnap.data();
          if(JSON.stringify(state) !== JSON.stringify(cloudState)) {
             state = cloudState;
             state.editMode = false;
             localStorage.setItem("devflow_state", JSON.stringify(state));
             renderProfile(); // re-render UI based on new state
          }
        }
      });
    } else {
      document.getElementById('logged-in-view').classList.add('hidden');
      document.getElementById('logged-in-view').classList.remove('flex');
      document.getElementById('logged-out-view').classList.remove('hidden');
      
      const avatarLarge = document.getElementById('user-avatar-large');
      avatarLarge.innerHTML = 'D';
      avatarLarge.classList.add('bg-gradient-to-br');
      
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
    }
  });
}

window.signInGoogle = function() {
  if (chrome && chrome.identity) {
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2.client_id;
    const redirectUri = chrome.identity.getRedirectURL(); 
    const scopes = encodeURIComponent(manifest.oauth2.scopes.join(' '));
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;

    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      function(redirect_url) {
        if (chrome.runtime.lastError || !redirect_url) {
          console.error(chrome.runtime.lastError);
          const errorMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : "Unknown error (popup closed or blocked)";
          alert("Sign in failed:\n" + errorMsg);
          return;
        }
        
        const urlParams = new URLSearchParams(new URL(redirect_url).hash.substring(1));
        const accessToken = urlParams.get('access_token');
        
        if (accessToken) {
          const credential = GoogleAuthProvider.credential(null, accessToken);
          signInWithCredential(auth, credential).then(() => {
            console.log("Signed in with Google!");
          }).catch((error) => {
            console.error("Firebase Auth Error", error);
            alert("Firebase sign in failed: " + error.message);
          });
        } else {
          alert("Could not extract access token from Google.");
        }
      }
    );
  } else {
    alert("Chrome Identity API not available.");
  }
}

window.signOutGoogle = function() {
  signOut(auth).then(() => {
    console.log("Signed out.");
  }).catch((error) => {
    console.error("Sign out error", error);
  });
}

// --- UI Updates ---
function updateTime() {
  const now = new Date();
  const options = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  document.getElementById("current-date").textContent =
    now.toLocaleDateString("en-US", options);
}

function updateGreeting() {
  const hour = new Date().getHours();
  let g = "Good Night";
  if (hour >= 5 && hour < 12) g = "Good Morning";
  else if (hour >= 12 && hour < 17) g = "Good Afternoon";
  else if (hour >= 17 && hour < 21) g = "Good Evening";
  document.getElementById("greeting").textContent =
    `${g}, ${state.userName}! 👋`;

  const avatar = document.getElementById("user-avatar");
  const avatarLarge = document.getElementById("user-avatar-large");

  if (currentUser && currentUser.photoURL) {
    avatar.innerHTML = `<img src="${escapeHTML(currentUser.photoURL)}" class="w-full h-full rounded-full object-cover">`;
    avatarLarge.innerHTML = `<img src="${escapeHTML(currentUser.photoURL)}" class="w-full h-full rounded-full object-cover">`;
    avatar.classList.remove('bg-gradient-to-br', 'from-indigo-500', 'to-purple-600');
    avatarLarge.classList.remove('bg-gradient-to-br', 'from-indigo-500', 'to-purple-600');
  } else {
    avatar.textContent = state.userName.charAt(0).toUpperCase();
    avatarLarge.textContent = state.userName.charAt(0).toUpperCase();
  }
}

function switchProfile(profile) {
  state.currentProfile = profile;
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.remove("active");
    if (el.dataset.profile === profile) el.classList.add("active");
  });
  renderProfile();
  saveState();
}

function renderProfile() {
  const p = state.profiles[state.currentProfile];

  // Render Links
  const grid = document.getElementById("quick-access-grid");
  grid.innerHTML =
    p.links
      .map(
        (l, i) => `
          <div class="quick-access-item flex flex-col items-center gap-2 group relative">
              <a href="${escapeHTML(l.url)}" target="_blank" class="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition overflow-hidden">
                  <img src="${escapeHTML(l.icon)}" class="w-8 h-8" data-fallback="https://www.google.com/s2/favicons?domain=${escapeHTML(l.url)}&sz=64">
              </a>
              <span class="text-xs text-gray-400 font-medium truncate w-full text-center">${escapeHTML(l.name)}</span>
              ${state.editMode ? `<button data-action="deleteLink" data-arg="${i}" class="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 shadow-lg hover:bg-red-600"><i data-lucide="x" class="w-3 h-3"></i></button>` : ""}
          </div>
      `
      )
      .join("") +
    `
          <button data-action="openModal" data-arg="addLinkModal" class="flex flex-col items-center gap-2 group">
              <div class="w-14 h-14 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center group-hover:border-indigo-500/50 transition">
                  <i data-lucide="plus" class="w-6 h-6 text-gray-500 group-hover:text-indigo-500 transition"></i>
              </div>
              <span class="text-xs text-gray-500">Add Link</span>
          </button>
      `;

  // Render Events
  const evList = document.getElementById("events-list");
  evList.innerHTML = p.events.length
    ? p.events
        .map(
          (e, i) => `
          <div class="flex items-center gap-4 group event-item">
              <div class="w-12 h-12 rounded-lg bg-white/5 flex flex-col items-center justify-center shrink-0 border border-white/5">
                  <span class="text-[10px] text-gray-500 uppercase">${new Date(e.date).toLocaleDateString("en-US", { month: "short" })}</span>
                  <span class="text-lg font-bold leading-none">${new Date(e.date).getDate()}</span>
              </div>
              <div class="flex-1">
                  <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full ${escapeHTML(e.color)}"></div>
                      <h4 class="font-medium text-sm">${escapeHTML(e.title)}</h4>
                  </div>
                  <p class="text-xs text-gray-500 ml-4">${escapeHTML(e.time)}</p>
              </div>
              <button data-action="deleteEvent" data-arg="${i}" class="delete-btn text-gray-600 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
      `
        )
        .join("")
    : '<p class="text-gray-600 text-sm py-2">No upcoming events</p>';

  // Render Projects
  const prList = document.getElementById("projects-list");
  prList.innerHTML = p.projects.length
    ? p.projects
        .map(
          (pr, i) => `
          <div class="group project-item">
              <div class="flex justify-between items-start mb-2">
                  <div>
                      <h4 class="font-bold text-sm">${escapeHTML(pr.name)}</h4>
                      <p class="text-xs text-gray-500">${escapeHTML(pr.stack)}</p>
                  </div>
                  <div class="flex items-center gap-3">
                      <span class="text-xs font-bold text-indigo-400 editable-progress" data-action="editProjectProgress" data-arg="${i}">${pr.progress}%</span>
                      <button data-action="deleteProject" data-arg="${i}" class="delete-btn text-gray-600 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                  </div>
              </div>
              <div class="progress-bar">
                  <div class="progress-fill" style="width: ${pr.progress}%"></div>
              </div>
          </div>
      `
        )
        .join("")
    : '<p class="text-gray-600 text-sm py-2">No active projects</p>';

  // Render Projects View All
  const prViewList = document.getElementById("projects-view-list");
  prViewList.innerHTML = p.projects.length
    ? p.projects
        .map(
          (pr, i) => `
          <div class="group project-item p-4 border border-white/10 rounded-lg">
              <div class="flex justify-between items-start mb-3">
                  <div>
                      <h4 class="font-bold">${escapeHTML(pr.name)}</h4>
                      <p class="text-sm text-gray-500">${escapeHTML(pr.stack)}</p>
                  </div>
                  <div class="flex items-center gap-3">
                      <span class="font-bold text-indigo-400 editable-progress cursor-pointer" data-action="editProjectProgress" data-arg="${i}">${pr.progress}%</span>
                      <button data-action="deleteProject" data-arg="${i}" class="delete-btn text-gray-600 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                  </div>
              </div>
              <div class="progress-bar">
                  <div class="progress-fill" style="width: ${pr.progress}%"></div>
              </div>
          </div>
      `
        )
        .join("")
    : '<p class="text-gray-600 text-sm py-4 text-center">No projects yet</p>';

  // Render Todos
  const tdList = document.getElementById("todo-list");
  tdList.innerHTML = p.todos.length
    ? p.todos
        .map(
          (t, i) => `
          <div class="flex items-center gap-3 group todo-item">
              <input type="checkbox" ${t.done ? "checked" : ""} data-onchange="toggleTodo" data-arg="${i}" class="w-5 h-5 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
              <span class="flex-1 text-sm ${t.done ? "text-gray-600 line-through" : "text-gray-300"}">${escapeHTML(t.text)}</span>
              <button data-action="deleteTodo" data-arg="${i}" class="delete-btn text-gray-600 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
      `
        )
        .join("")
    : '<p class="text-gray-600 text-sm py-4 text-center">All caught up!</p>';

  // Render Bookmarks
  const bmList = document.getElementById("bookmarks-list");
  bmList.innerHTML = p.bookmarks.length
    ? p.bookmarks
        .map(
          (b, i) => `
          <div data-action="openBookmarkFolder" data-arg="${i}" class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition cursor-pointer group bookmark-item">
              <i data-lucide="folder" class="w-5 h-5 text-yellow-500"></i>
              <span class="text-sm flex-1">${escapeHTML(b.name)}</span>
              <span class="text-xs text-gray-500">${b.links ? b.links.length : 0}</span>
              <button data-action="deleteBookmark" data-arg="${i}" data-stop="true" class="delete-btn text-gray-600 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
      `
        )
        .join("")
    : '<p class="text-gray-600 text-sm py-2">No bookmark folders</p>';

  // Render Bookmarks View All
  const bmViewList = document.getElementById("bookmarks-view-list");
  bmViewList.innerHTML = p.bookmarks.length
    ? p.bookmarks
        .map(
          (b, i) => `
          <div data-action="openBookmarkFolder" data-arg="${i}" class="p-4 border border-white/10 rounded-lg hover:bg-white/5 transition cursor-pointer group bookmark-item">
              <div class="flex items-center gap-3 justify-between">
                  <div class="flex items-center gap-3">
                      <i data-lucide="folder" class="w-6 h-6 text-yellow-500"></i>
                      <div>
                          <h4 class="font-bold">${escapeHTML(b.name)}</h4>
                          <p class="text-xs text-gray-500">${b.links ? b.links.length : 0} items</p>
                      </div>
                  </div>
                  <button data-action="deleteBookmark" data-arg="${i}" data-stop="true" class="delete-btn text-gray-600 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
              </div>
          </div>
      `
        )
        .join("")
    : '<p class="text-gray-600 text-sm py-4 text-center">No bookmark folders</p>';

  renderQuote();
  lucide.createIcons();
}

// --- Feature Logic ---
function toggleEditMode() {
  state.editMode = !state.editMode;
  document.getElementById("edit-mode-btn").textContent = state.editMode
    ? "Done"
    : "Edit";
  renderProfile();
}

function rotateQuote() {
  state.quoteIndex = (state.quoteIndex + 1) % quotes.length;
  renderQuote();
  saveState();
}

function renderQuote() {
  const q = quotes[state.quoteIndex];
  document.getElementById("quote-text").textContent = `"${q.text}"`;
  document.getElementById("quote-author").textContent = `— ${q.author}`;
}

function editProjectProgress(index) {
  const project = state.profiles[state.currentProfile].projects[index];
  const newProgress = prompt(
    `Update progress for "${project.name}" (0-100):`,
    project.progress
  );
  if (newProgress !== null) {
    const value = Math.min(100, Math.max(0, parseInt(newProgress) || 0));
    project.progress = value;
    saveState();
    renderProfile();
  }
}

function openBookmarkFolder(index) {
  const folder = state.profiles[state.currentProfile].bookmarks[index];
  state.currentBookmarkFolder = index;

  document.getElementById("folder-title").textContent = folder.name;
  const contentsDiv = document.getElementById("folder-contents");

  if (folder.links && folder.links.length > 0) {
    contentsDiv.innerHTML = folder.links
      .map(
        (link, i) => `
              <div class="bookmark-link-item">
                  <i data-lucide="link" class="w-4 h-4 text-indigo-400"></i>
                  <a href="${escapeHTML(link.url)}" target="_blank">${escapeHTML(link.title)}</a>
                  <button data-action="deleteBookmarkLink" data-arg="${i}" class="text-gray-600 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
              </div>
          `
      )
      .join("");
  } else {
    contentsDiv.innerHTML =
      '<p class="text-gray-600 text-sm py-4 text-center">No bookmarks in this folder yet</p>';
  }

  lucide.createIcons();
  openModal("bookmarkFolderModal");
}

function addBookmarkLink() {
  const url = document.getElementById("new-bookmark-url").value.trim();
  const title = document
    .getElementById("new-bookmark-title")
    .value.trim();

  if (!url || !title) {
    alert("Please fill in both fields");
    return;
  }
  
  const finalUrl = url.startsWith("http://") || url.startsWith("https://") ? url : "https://" + url;

  const folder =
    state.profiles[state.currentProfile].bookmarks[
      state.currentBookmarkFolder
    ];
  if (!folder.links) folder.links = [];

  folder.links.push({ title, url: finalUrl });
  saveState();
  openBookmarkFolder(state.currentBookmarkFolder);

  document.getElementById("new-bookmark-url").value = "";
  document.getElementById("new-bookmark-title").value = "";
}

function deleteBookmarkLink(index) {
  const folder =
    state.profiles[state.currentProfile].bookmarks[
      state.currentBookmarkFolder
    ];
  folder.links.splice(index, 1);
  saveState();
  openBookmarkFolder(state.currentBookmarkFolder);
}

function openGoogleCalendar() {
  const p = state.profiles[state.currentProfile];
  if (p.events && p.events.length > 0) {
    // Create Google Calendar URL with events
    const event = p.events[0];
    const startDate = new Date(event.date)
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "");
    window.open(
      `https://calendar.google.com/calendar/u/0/r/eventedit?text=${encodeURIComponent(event.title)}&dates=${startDate}/${startDate}`,
      "_blank"
    );
  } else {
    window.open("https://calendar.google.com", "_blank");
  }
}

function setupSearch() {
  const input = document.getElementById("main-search");
  const suggestions = document.getElementById("search-suggestions");

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      input.focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value) {
      const engines = {
        google: "https://google.com/search?q=",
        duckduckgo: "https://duckduckgo.com/?q=",
        bing: "https://bing.com/search?q=",
        brave: "https://search.brave.com/search?q=",
      };
      window.open(
        engines[state.searchEngine] + encodeURIComponent(input.value),
        "_blank"
      );
      input.value = "";
      suggestions.classList.add("hidden");
    }
  });

  input.addEventListener("input", () => {
    const val = input.value.toLowerCase();
    if (!val) {
      suggestions.classList.add("hidden");
      return;
    }

    const p = state.profiles[state.currentProfile];
    const matches = p.links.filter((l) =>
      l.name.toLowerCase().includes(val)
    );

    if (matches.length) {
      suggestions.innerHTML = matches
        .map(
          (m) => `
                  <div data-action="openUrl" data-arg="${m.url}" class="p-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 border-b border-white/5 last:border-0">
                      <i data-lucide="external-link" class="w-4 h-4 text-gray-500"></i>
                      <span>${escapeHTML(m.name)}</span>
                      <span class="text-xs text-gray-600 ml-auto">${escapeHTML(m.url)}</span>
                  </div>
              `
        )
        .join("");
      suggestions.classList.remove("hidden");
      lucide.createIcons();
    } else {
      suggestions.classList.add("hidden");
    }
  });

  // Auto-focus search bar on new tab open
  input.focus();
}

async function fetchWeather() {
  try {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        updateWeatherUI(latitude, longitude);
      },
      async () => {
        try {
          const res = await fetch("https://ipapi.co/json/");
          const data = await res.json();
          updateWeatherUI(data.latitude, data.longitude, data.city);
        } catch (e) {
          console.error("IP API failed", e);
        }
      }
    );
  } catch (e) {
    console.error("Weather failed", e);
  }
}

async function updateWeatherUI(lat, lon, city = "Local") {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
    );
    const data = await res.json();

    document.getElementById("weather-location").textContent = city;
    document.getElementById("weather-temp").textContent =
      `${Math.round(data.current.temperature_2m)}°C`;
    document.getElementById("weather-humidity").textContent =
      `${data.current.relative_humidity_2m}%`;
    document.getElementById("weather-wind").textContent =
      `${Math.round(data.current.wind_speed_10m)} km/h`;

    const codes = {
      0: "Clear Sky",
      1: "Mainly Clear",
      2: "Partly Cloudy",
      3: "Overcast",
      45: "Foggy",
      51: "Drizzle",
      61: "Rain",
      71: "Snow",
      95: "Thunderstorm",
    };
    document.getElementById("weather-desc").textContent =
      codes[data.current.weather_code] || "Cloudy";

    document.getElementById("weather-aqi").textContent = "32 Good";
  } catch (e) {
    console.error("Weather update failed", e);
  }
}

// --- Data Persistence Operations ---
function saveNewLink() {
  const name = document.getElementById("link-name").value.trim();
  const url = document.getElementById("link-url").value.trim();
  if (!name || !url) {
    alert("Please fill in all fields");
    return;
  }
  
  const finalUrl = url.startsWith("http://") || url.startsWith("https://") ? url : "https://" + url;

  state.profiles[state.currentProfile].links.push({
    name,
    url: finalUrl,
    icon: `https://www.google.com/s2/favicons?domain=${finalUrl}&sz=64`,
  });
  saveState();
  renderProfile();
  closeModal();
  document.getElementById("link-name").value = "";
  document.getElementById("link-url").value = "";
}

function deleteLink(index) {
  state.profiles[state.currentProfile].links.splice(index, 1);
  saveState();
  renderProfile();
}

function saveNewProject() {
  const name = document.getElementById("proj-name").value.trim();
  const stack = document.getElementById("proj-stack").value.trim();
  const progress = document.getElementById("proj-progress").value;
  if (!name) {
    alert("Please enter a project name");
    return;
  }

  state.profiles[state.currentProfile].projects.push({
    id: Date.now(),
    name,
    stack,
    progress: parseInt(progress) || 0,
  });
  saveState();
  renderProfile();
  closeModal();
  document.getElementById("proj-name").value = "";
  document.getElementById("proj-stack").value = "";
  document.getElementById("proj-progress").value = "0";
}

function deleteProject(index) {
  state.profiles[state.currentProfile].projects.splice(index, 1);
  saveState();
  renderProfile();
}

function saveNewEvent() {
  const name = document.getElementById("event-name").value.trim();
  const date = document.getElementById("event-date").value;
  const time = document.getElementById("event-time").value;
  const color = document.getElementById("event-color").value;

  if (!name || !date || !time) {
    alert("Please fill in all fields");
    return;
  }

  state.profiles[state.currentProfile].events.push({
    id: Date.now(),
    title: name,
    date,
    time,
    color,
  });
  saveState();
  renderProfile();
  closeModal();
  document.getElementById("event-name").value = "";
  document.getElementById("event-date").value = "";
  document.getElementById("event-time").value = "";
}

function deleteEvent(index) {
  state.profiles[state.currentProfile].events.splice(index, 1);
  saveState();
  renderProfile();
}

function saveNewTask() {
  const text = document.getElementById("task-text").value.trim();
  if (!text) {
    alert("Please enter a task");
    return;
  }

  state.profiles[state.currentProfile].todos.push({
    id: Date.now(),
    text,
    done: false,
  });
  saveState();
  renderProfile();
  closeModal();
  document.getElementById("task-text").value = "";
}

function toggleTodo(index) {
  const todo = state.profiles[state.currentProfile].todos[index];
  todo.done = !todo.done;
  saveState();
  renderProfile();
}

function deleteTodo(index) {
  state.profiles[state.currentProfile].todos.splice(index, 1);
  saveState();
  renderProfile();
}

function saveNewBookmark() {
  const name = document.getElementById("bookmark-name").value.trim();
  if (!name) {
    alert("Please enter a folder name");
    return;
  }

  state.profiles[state.currentProfile].bookmarks.push({
    name,
    links: [],
  });
  saveState();
  renderProfile();
  closeModal();
  document.getElementById("bookmark-name").value = "";
}

function deleteBookmark(index) {
  state.profiles[state.currentProfile].bookmarks.splice(index, 1);
  saveState();
  renderProfile();
}

function saveProfile() {
  const name = document.getElementById("profile-name").value.trim();
  if (name) {
    state.userName = name;
    updateGreeting();
  }
  state.userRole = document.getElementById("profile-role").value.trim();
  saveState();
  closeModal();
}

function saveNotes() {
  state.notes = document.getElementById("notes-text").value;
  saveState();
  closeModal();
}

// --- Modal System ---
function openModal(id) {
  document.getElementById("modal-container").classList.remove("hidden");
  document
    .querySelectorAll(".modal-content")
    .forEach((m) => m.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "settingsModal") {
    document.getElementById("setting-name").value = state.userName;
    document.getElementById("setting-engine").value = state.searchEngine;
  }

  if (id === "profileModal") {
    document.getElementById("profile-name").value = state.userName;
    document.getElementById("profile-role").value = state.userRole;
  }

  if (id === "notesModal") {
    document.getElementById("notes-text").value = state.notes;
  }
}

function closeModal() {
  if (
    !document.getElementById("settingsModal").classList.contains("hidden")
  ) {
    state.userName =
      document.getElementById("setting-name").value || "Developer";
    state.searchEngine = document.getElementById("setting-engine").value;
    updateGreeting();
    saveState();
  }
  document.getElementById("modal-container").classList.add("hidden");
}

function factoryReset() {
  if (
    confirm(
      "Are you sure you want to reset all data? This cannot be undone."
    )
  ) {
    localStorage.removeItem("devflow_state");
    location.reload();
  }
}

function toggleNotifications() {
  const panel = document.getElementById("notif-panel");
  panel.classList.toggle("hidden");
}

function clearNotifications() {
  document.getElementById("notif-list").innerHTML =
    '<p class="text-center py-4">No new notifications</p>';
  document.getElementById("notif-dot").classList.add("hidden");
}

function toggleTheme() {
  alert(
    "This theme is optimized for 'DevFlow Dark'. Light mode is coming in a future update!"
  );
}

// Start execution
// init() will be called at the bottom of the file

// === MV3 Event Delegation (replaces inline onclick/onchange handlers) ===
document.addEventListener('click', function(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    
    if (target.getAttribute('data-stop') === 'true') {
        e.stopPropagation();
    }
    
    const action = target.getAttribute('data-action');
    const arg = target.getAttribute('data-arg');
    
    switch(action) {
        case 'openUrl':
            window.open(arg, '_blank');
            break;
        case 'switchProfile': switchProfile(arg); break;
        case 'openModal': openModal(arg); break;
        case 'closeModal': closeModal(); break;
        case 'toggleTheme': toggleTheme(); break;
        case 'toggleNotifications': toggleNotifications(); break;
        case 'clearNotifications': clearNotifications(); break;
        case 'toggleEditMode': toggleEditMode(); break;
        case 'openGoogleCalendar': openGoogleCalendar(); break;
        case 'rotateQuote': rotateQuote(); break;
        case 'saveNewLink': saveNewLink(); break;
        case 'saveNewProject': saveNewProject(); break;
        case 'saveNewEvent': saveNewEvent(); break;
        case 'saveNewTask': saveNewTask(); break;
        case 'saveNewBookmark': saveNewBookmark(); break;
        case 'saveProfile': saveProfile(); break;
        case 'saveNotes': saveNotes(); break;
        case 'factoryReset': factoryReset(); break;
        case 'addBookmarkLink': addBookmarkLink(); break;
        case 'deleteLink': deleteLink(parseInt(arg)); break;
        case 'deleteEvent': deleteEvent(parseInt(arg)); break;
        case 'deleteProject': deleteProject(parseInt(arg)); break;
        case 'deleteTodo': deleteTodo(parseInt(arg)); break;
        case 'deleteBookmark': deleteBookmark(parseInt(arg)); break;
        case 'deleteBookmarkLink': deleteBookmarkLink(parseInt(arg)); break;
        case 'editProjectProgress': editProjectProgress(parseInt(arg)); break;
        case 'openBookmarkFolder': openBookmarkFolder(parseInt(arg)); break;
        case 'signInGoogle': signInGoogle(); break;
        case 'signOutGoogle': signOutGoogle(); break;
    }
});

document.addEventListener('change', function(e) {
    const target = e.target.closest('[data-onchange]');
    if (!target) return;
    
    const action = target.getAttribute('data-onchange');
    const arg = target.getAttribute('data-arg');
    
    switch(action) {
        case 'toggleTodo': toggleTodo(parseInt(arg)); break;
    }
});

// Initialize the application after all listeners are registered
init();
