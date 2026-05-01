import { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../firebase";

function ChatPage({ profile, user }) {
  const displayName = profile.username || profile.email || "Guest";

  const [chatrooms, setChatrooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [showCreateBox, setShowCreateBox] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [messageText, setMessageText] = useState("");

  const [roomDescription, setRoomDescription] = useState("");
  const [roomVisibility, setRoomVisibility] = useState("public");
  const [roomPassword, setRoomPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const [showPasswordBox, setShowPasswordBox] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(null);
  const [joinPassword, setJoinPassword] = useState("");

  const handledInviteRef = useRef(false);

  const selectedRoom = chatrooms.find((room) => room.id === selectedRoomId);

  const isRoomOwner = (room) => room.createdByUid === user?.uid;
  const isJoinedRoom = (room) => room.members?.includes(user?.uid);
  const canEnterRoom = (room) => isRoomOwner(room) || isJoinedRoom(room);

  useEffect(() => {
    const q = query(collection(db, "chatrooms"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setChatrooms(rooms);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomIdFromUrl = params.get("room");

    if (!roomIdFromUrl) return;
    if (handledInviteRef.current) return;
    if (chatrooms.length === 0) return;

    const targetRoom = chatrooms.find((room) => room.id === roomIdFromUrl);

    if (!targetRoom) {
      window.history.replaceState({}, "", window.location.pathname);
      handledInviteRef.current = true;
      return;
    }

    handledInviteRef.current = true;

    if (canEnterRoom(targetRoom)) {
      selectRoom(targetRoom.id);
      return;
    }

    if (targetRoom.visibility === "private") {
      setJoiningRoom(targetRoom);
      setJoinPassword("");
      setShowPasswordBox(true);
      return;
    }

    joinRoom(targetRoom);
  }, [chatrooms, user]);

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, "chatrooms", selectedRoomId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setMessages(roomMessages);
    });

    return () => unsubscribe();
  }, [selectedRoomId]);

  const selectRoom = (roomId) => {
    setSelectedRoomId(roomId);
    window.history.pushState({}, "", `?room=${roomId}`);
  };

  const backToRoomList = () => {
    setSelectedRoomId(null);
    window.history.pushState({}, "", window.location.pathname);
  };

  const joinRoom = async (room) => {
    if (!user) {
      alert("請先登入");
      return;
    }

    if (canEnterRoom(room)) {
      selectRoom(room.id);
      return;
    }

    if (room.visibility === "private") {
      setJoiningRoom(room);
      setJoinPassword("");
      setShowPasswordBox(true);
      return;
    }

    await updateDoc(doc(db, "chatrooms", room.id), {
      members: arrayUnion(user.uid),
    });

    selectRoom(room.id);
  };

  const leaveChatroom = async (roomId) => {
    if (!user) return;

    const room = chatrooms.find((room) => room.id === roomId);
    if (!room) return;

    if (isRoomOwner(room)) {
      alert("房主不能退出自己的聊天室，只能刪除聊天室");
      return;
    }

    await updateDoc(doc(db, "chatrooms", roomId), {
      members: arrayRemove(user.uid),
    });

    if (selectedRoomId === roomId) {
      backToRoomList();
    }
  };

  const confirmJoinPrivateRoom = async () => {
    if (!joiningRoom || !user) return;

    if (joinPassword !== joiningRoom.password) {
      alert("密碼錯誤");
      return;
    }

    await updateDoc(doc(db, "chatrooms", joiningRoom.id), {
      members: arrayUnion(user.uid),
    });

    setShowPasswordBox(false);
    setJoinPassword("");
    selectRoom(joiningRoom.id);
    setJoiningRoom(null);
  };

  const createChatroom = async () => {
    if (!roomName.trim() || !user) return;

    if (roomVisibility === "private" && !roomPassword.trim()) {
      alert("Private chatroom 需要設定密碼");
      return;
    }

    const docRef = await addDoc(collection(db, "chatrooms"), {
      name: roomName.trim(),
      description: roomDescription.trim(),
      visibility: roomVisibility,
      password: roomVisibility === "private" ? roomPassword.trim() : "",
      createdBy: displayName,
      createdByUid: user.uid,
      members: [user.uid],
      createdAt: serverTimestamp(),
    });

    selectRoom(docRef.id);

    setRoomName("");
    setRoomDescription("");
    setRoomVisibility("public");
    setRoomPassword("");
    setShowCreateBox(false);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedRoomId) return;

    await addDoc(collection(db, "chatrooms", selectedRoomId, "messages"), {
      text: messageText.trim(),
      sender: displayName,
      senderUid: user?.uid || "",
      createdAt: serverTimestamp(),
    });

    setMessageText("");
  };

  const deleteChatroom = async (roomId) => {
    const confirmDelete = window.confirm("確定要刪除這個聊天室嗎？");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "chatrooms", roomId));

    if (selectedRoomId === roomId) {
      backToRoomList();
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("room") === roomId) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  const copyInviteLink = async () => {
    if (!selectedRoomId) return;

    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${selectedRoomId}`;

    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <main className="mainLayout">
      <aside className={selectedRoom ? "sidebar hideOnMobile" : "sidebar"}>
        <h2>Chatrooms</h2>

        <div className="chatroomList">
          {chatrooms.length === 0 ? (
            <p className="emptyText">目前還沒有聊天室</p>
          ) : (
            chatrooms.map((room) => (
              <div
                key={room.id}
                className={
                  selectedRoomId === room.id
                    ? "chatroomCard activeRoom"
                    : "chatroomCard"
                }
              >
                <div className="roomCardTop">
                  <div>
                    <h3>{room.name}</h3>
                    <p className="roomCreator">Created by {room.createdBy}</p>
                  </div>

                  <span
                    className={
                      room.visibility === "private"
                        ? "roomBadge privateBadge"
                        : "roomBadge publicBadge"
                    }
                  >
                    {room.visibility === "private" ? "Private" : "Public"}
                  </span>
                </div>

                <p className="roomDescription">
                  {room.description || "No description"}
                </p>

                <div className="roomActions">
                  <button
                    type="button"
                    className={
                      canEnterRoom(room)
                        ? "joinRoomButton joinedRoomButton"
                        : "joinRoomButton"
                    }
                    onClick={() => joinRoom(room)}
                  >
                    {canEnterRoom(room) ? "已加入" : "加入"}
                  </button>

                  {canEnterRoom(room) && !isRoomOwner(room) && (
                    <button
                      type="button"
                      className="leaveRoomButton"
                      onClick={() => leaveChatroom(room.id)}
                    >
                      退出
                    </button>
                  )}

                  {isRoomOwner(room) && (
                    <button
                      type="button"
                      className="deleteRoomButton"
                      onClick={() => deleteChatroom(room.id)}
                    >
                      刪除
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {selectedRoom ? (
        <section className="chatPanel showChatOnMobile">
          <div className="chatHeader">
            <button
              type="button"
              className="backToRoomsButton"
              onClick={backToRoomList}
            >
              ←
            </button>

            <div className="chatHeaderInfo">
              <h2>{selectedRoom.name}</h2>
              <p>{selectedRoom.description || "No description"}</p>
              <small>
                {selectedRoom.visibility === "private" ? "Private" : "Public"}
              </small>
            </div>

            <button
              type="button"
              className="inviteButton"
              onClick={copyInviteLink}
            >
              {copied ? "已複製" : "複製邀請連結"}
            </button>
          </div>

          <div className="messageArea">
            {messages.length === 0 ? (
              <p className="emptyText">目前還沒有訊息</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="messageBubble">
                  <strong>{message.sender}</strong>
                  <p>{message.text}</p>
                  <small>
                    {message.createdAt?.toDate
                      ? message.createdAt.toDate().toLocaleTimeString()
                      : ""}
                  </small>
                </div>
              ))
            )}
          </div>

          <div className="messageInputBar">
            <input
              placeholder="輸入訊息"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                }
              }}
            />

            <button type="button" onClick={sendMessage}>
              送出
            </button>
          </div>
        </section>
      ) : (
        <section className="chatPanel emptyChatPanel">
          <h2>請先選擇或建立聊天室</h2>
        </section>
      )}

      <button
        type="button"
        className={
          selectedRoom
            ? "floatingAddButton hideAddOnMobile"
            : "floatingAddButton"
        }
        onClick={() => setShowCreateBox(true)}
      >
        +
      </button>

      {showCreateBox && (
        <div className="modalOverlay">
          <div className="createRoomModal">
            <button
              type="button"
              className="closeButton"
              onClick={() => setShowCreateBox(false)}
            >
              ×
            </button>

            <h2>Create Chatroom</h2>

            <input
              type="text"
              placeholder="Chatroom name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />

            <textarea
              placeholder="Chatroom description"
              value={roomDescription}
              onChange={(e) => setRoomDescription(e.target.value)}
            />

            <select
              value={roomVisibility}
              onChange={(e) => setRoomVisibility(e.target.value)}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>

            {roomVisibility === "private" && (
              <input
                type="password"
                placeholder="Set password"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
              />
            )}

            <button type="button" onClick={createChatroom}>
              Create
            </button>
          </div>
        </div>
      )}

      {showPasswordBox && (
        <div className="modalOverlay">
          <div className="createRoomModal">
            <button
              type="button"
              className="closeButton"
              onClick={() => {
                setShowPasswordBox(false);
                setJoinPassword("");
                setJoiningRoom(null);
              }}
            >
              ×
            </button>

            <h2>加入私人聊天室</h2>
            <p>{joiningRoom?.name}</p>

            <input
              type="password"
              placeholder="請輸入聊天室密碼"
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  confirmJoinPrivateRoom();
                }
              }}
            />

            <button type="button" onClick={confirmJoinPrivateRoom}>
              加入
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default ChatPage;