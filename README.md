# NanOS - Browser Desktop Environment

MyOS is a lightweight, responsive desktop environment simulator built entirely with native web technologies: vanilla JavaScript, HTML5, and CSS3. It runs directly in the browser without any external frameworks or dependencies.

## Features
- Window Manager: Supports drag-and-drop, dynamic z-indexing for focus control, minimizing to the dock, and closing animations.
- Built-in Applications: Includes a text-area Notes app with localStorage persistence, a fully functional Calculator, a Media Player with progressive scrubbing, and an About Me profile window.
- System Dock and Top Bar: Displays active apps, real-time localized clock/date, and a global dark/light theme toggle.
- Clean Architecture: Uses a custom DOM builder utility and declarative configuration to easily add new applications.

## Project Structure
- index.html: Basic markup and core UI containers (Topbar, Desktop, Dock).
- style.css: Layout styles, theme color variables, and transition animations.
- app.js: Core system logic, window management, event bindings, and app configurations.

## Getting Started
Since this is a pure client-side project, you can run it locally without any installation or compilation steps.
1. Clone or download the repository.
2. Open index.html in any modern web browser.

Using a local server extension (like Live Server in VS Code) is recommended to ensure localStorage and media streaming function properly.
