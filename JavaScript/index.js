const dom = {
  divSelectUsers: document.querySelector(".div_select_users"),
  divUser: document.querySelector(".div_user"),
  divRooms: document.querySelector(".div_rooms"),
  divChat: document.querySelector(".div_chat"),
  message: document.querySelector("#message"),
};

const domain = "http://localhost:8000/api/";
let userLoggedId;
let currentRoom = "";
let sn = "sn" + Math.floor(Math.random() * 10000 + 1);

console.log("Сформирован случайный номер для WebSocket:", sn);

const socket = createWebSocket(
  "ws://localhost:8000/ws/instructions/" + sn,
  loadUsers
);
const chatSocket = createWebSocket("ws://localhost:8000/ws/chat/" + sn);

function createWebSocket(url, onOpenCallback) {
  const ws = new WebSocket(url);
  ws.onopen = onOpenCallback;
  ws.onclose = handleConnectionError;
  ws.onerror = handleError;
  return ws;
}

function handleConnectionError(event) {
  console.error(event);
  alert("НЕТ СВЯЗИ С СЕРВЕРОМ DJANGO! ПРОВЕРЬТЕ СОСТОЯНИЕ СЕРВЕРА!");
}

function handleError(evt) {
  dom.message.innerText = evt.message || "Ошибка WebSocket";
}

function loadUsers() {
  socket.send(JSON.stringify({ load: "users" }));
}

socket.onmessage = function (event) {
  const data = JSON.parse(event.data);
  if (data.message) {
    dom.message.innerText = data.message;
  } else if (data.UserList) {
    userLoggedId ? viewUserCard(userLoggedId) : printUsers(data);
  } else if (data.RoomList) {
    printRooms(data);
  } else if (data.MessageList) {
    printChat(data);
  }
};

function printUsers(data) {
  const userList = Object.entries(data)
    .map(
      ([key, value]) =>
        `<tr>
            <td>${value}</td>
            <td><button onclick="userLogged(${key})">выбрать</button></td>
            <td><button onclick="deleteUser(${key})">удалить</button></td>
        </tr>`
    )
    .join("");

  dom.divSelectUsers.innerHTML = `<table>${userList}</table><br>`;
}

document.querySelector(".btn_create_user").addEventListener("click", () => {
  const name = document.getElementById("input_user").value;
  if (name) {
    socket.send(JSON.stringify({ create_user: name }));
    document.getElementById("input_user").value = "";
  }
});

function deleteUser(id) {
  socket.send(JSON.stringify({ delete_user: id }));
}

function userLogged(userId) {
  if (!userLoggedId) {
    document
      .querySelector(".div_main")
      .removeChild(document.querySelector(".div_start"));
  }
  userLoggedId = userId;
  viewUserCard(userId);
}

function viewUserCard(userId) {
  fetch(`${domain}users/${userId}/`)
    .then((response) => response.json())
    .then((result) => printUserCard(result))
    .catch((err) => console.log(err));
  socket.send(JSON.stringify({ load: "rooms" }));
}

function printUserCard(item) {
  const room = item.room
    ? listrooms[item.room[item.room.length - 2]]
    : "не выбрана";
  dom.divUser.innerHTML = `
    <div class="div">
        <img src="${item.avatar}">
        <br>
        <strong>Сменить аватарку:</strong><br>
        <input id="avatar-input" type="file" accept="image/*"><br>
        <button onclick="editAvatar(${item.id})">отправить</button>
      
        <p>Имя: ${item.name} <button onclick="changeUserName(${item.id})">изменить</button></p>
       
        <h4 class="message" id="message"></h4>
    </div>`;
}

async function editAvatar(userId) {
  const formData = new FormData();
  const fileField = document.querySelector("#avatar-input").files[0];
  if (fileField) {
    formData.append("avatar", fileField);
    formData.append("avatar_small", fileField);
    try {
      const response = await fetch(`${domain}users/${userId}/`, {
        method: "PATCH",
        body: formData,
      });
      console.log(
        "Фото юзера сохранено:",
        JSON.stringify(await response.json())
      );
    } catch (error) {
      console.error("Ошибка:", error);
    }
    viewUserCard(userId);
  } else {
    console.log("Файл не выбран!");
    dom.message.innerText = "!!! файл не выбран";
  }
}

function changeUserName(userId) {
  const name = prompt("Введите новое имя");
  if (name) {
    socket.send(
      JSON.stringify({ order: "changeUserName", id: userId, name: name })
    );
  }
}

function printRooms(data) {
  const roomList = Object.entries(data)
    .map(
      ([key, value]) =>
        `<tr>
            <td><b>${value}</b></td>
            <td><button onclick="deleteRoom(${key})">удалить</button></td>
            <td><button onclick="editRoom(${key})">изменить</button></td>
            <td><button onclick="selectRoom(${key})">подключиться</button></td>
        </tr>`
    )
    .join("");

  dom.divRooms.innerHTML = `
    <table>${roomList}</table><br>
    <input type="text" id="input_room" name="name_new_room" size="22" placeholder="Введите имя новой комнаты"><br>
    <button class="btn btn_new_room">Создать комнату</button>`;

  document.querySelector(".btn_new_room").addEventListener("click", () => {
    const name = document.getElementById("input_room").value;
    if (name) {
      socket.send(JSON.stringify({ create_room: name }));
      document.getElementById("input_room").value = "";
    }
  });
}

function deleteRoom(id) {
  socket.send(JSON.stringify({ delete_room: id }));
}

function editRoom(id) {
  const name = prompt("Введите новое имя комнаты");
  if (name) {
    socket.send(
      JSON.stringify({ order: "changeRoomName", id: id, name: name })
    );
  }
}

function printChat(data) {
  dom.divChat.innerHTML = `
    <h3 style="text-align: center;">Комната: ${data["MessageList"]}</h3>
    <textarea class="textarea" name="textarea"></textarea><br>
    <input type="text" id="input_message" name="input_message" size="22" placeholder="Введите сообщение"><br>
    <button class="btn btn_message">Отправить</button>`;

  const textarea = document.querySelector(".textarea");
  delete data.MessageList;

  for (const messageElement in data) {
    for (const key in data[messageElement]) {
      textarea.value += `${key}: ${data[messageElement][key]}\n`;
    }
  }

  document.querySelector(".btn_message").addEventListener("click", () => {
    const message = document.getElementById("input_message").value;
    if (message) {
      chatSocket.send(
        JSON.stringify({
          usersendcommandroom: "message",
          room_id: currentRoom,
          userid: userLoggedId,
          message: message,
        })
      );
      document.getElementById("input_message").value = "";
    }
  });

  chatSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    textarea.value += `${data["name"]}: ${data["message"]}\n`;
  };
}

function selectRoom(id) {
  socket.send(JSON.stringify({ load: "messageList", newroom_id: id }));
  chatSocket.send(
    JSON.stringify({
      usersendcommandroom: "roomselect",
      newroom_id: id,
      oldroom_id: currentRoom,
    })
  );
  currentRoom = id;
}
