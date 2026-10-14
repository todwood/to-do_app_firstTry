# 📝 Focus Tasks - Clean & Modern To-Do App

A sleek, fast, and responsive To-Do application built with **Node.js** and clean Vanilla JavaScript, HTML5, and CSS.

---

## ✨ Features

- **Add Tasks**: Quickly create tasks with titles up to 250 characters.
- **Mark Complete**: Instant visual toggle with animated emerald checkmark and smooth strikethrough.
- **Delete Tasks**: Remove any task with a single click and smooth slide-out animation.
- **Inline Editing**: Double-click any task title to edit it inline, with instant auto-save on <kbd>Enter</kbd> or blur.
- **Task Filtering**: Filter by **All**, **Active**, and **Completed** tasks with live item count badges.
- **Progress Tracking**: Real-time progress bar displaying completion percentage.
- **Bulk Actions**: One-click "Clear completed" button.
- **Persistent Storage**: Data automatically persists to `data/todos.json`.
- **Zero External Dependencies**: Built with Node.js standard library modules (`http`, `fs`, `path`, `crypto`).

---

## 🚀 Getting Started

### 1. Start the Server

From this directory (`c:\Users\todwood\Documents\Antigravity Work\ToDoApp`), run:

```bash
npm start
```

or directly with Node:

```bash
node server.js
```

### 2. Open in Your Browser

Navigate to:
```
http://localhost:3000
```

---

## 📁 Project Structure

```
ToDoApp/
├── server.js            # Zero-dependency Node.js HTTP server & REST API
├── package.json         # Project metadata and start scripts
├── data/
│   └── todos.json       # JSON file storage for tasks
└── public/
    ├── index.html       # Semantic HTML5 layout
    ├── styles.css       # Clean, modern design system with glassmorphic aesthetics
    ├── app.js           # Client-side state management & REST API client
    └── favicon.svg      # SVG app icon
```

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/todos` | Retrieve all tasks |
| `POST` | `/api/todos` | Add a new task (`{ "title": "..." }`) |
| `PATCH` | `/api/todos/:id` | Update task status or title (`{ "completed": true }`) |
| `DELETE` | `/api/todos/:id` | Delete a task by ID |
| `DELETE` | `/api/todos?completed=true` | Clear all completed tasks |
