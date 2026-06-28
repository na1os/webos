let zIndex = 1;

function openApp(app) {
  const win = document.createElement("div");
  win.className = "window";
  win.style.top = "100px";
  win.style.left = "100px";
  win.style.zIndex = zIndex++;

  let content = "";

  if (app === "notes") {
    content = `<textarea id="notesBox" style="width:100%;height:150px;">${localStorage.getItem("notes") || ""}</textarea>`;
  }

  if (app === "calc") {
    content = `<p>2 + 2 = 4 (demo)</p>`;
  }

  if (app === "terminal") {
    content = `<p>> NebulaOS terminal</p>`;
  }

  win.innerHTML = `
    <div class="title"> ${app.toUpperCase()} </div>
    ${content}
    <button onclick="this.parentElement.remove()">Close</button>
  `;

  document.body.appendChild(win);

  makeDraggable(win);

  // NEW FEATURE: auto save notes
  if (app === "notes") {
    setInterval(() => {
      const box = document.getElementById("notesBox");
      if (box) localStorage.setItem("notes", box.value);
    }, 500);
  }
}

// DRAG SYSTEM
function makeDraggable(win) {
  let isDown = false;
  let offsetX, offsetY;

  const title = win.querySelector(".title");

  title.onmousedown = (e) => {
    isDown = true;
    offsetX = e.clientX - win.offsetLeft;
    offsetY = e.clientY - win.offsetTop;
    win.style.zIndex = zIndex++;
  };

  document.onmouseup = () => isDown = false;

  document.onmousemove = (e) => {
    if (!isDown) return;
    win.style.left = e.clientX - offsetX + "px";
    win.style.top = e.clientY - offsetY + "px";
  };
}