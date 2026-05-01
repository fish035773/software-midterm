import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
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

  const selectedRoom = chatrooms.find((room) => room.id === selectedRoomId);

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

  const createChatroom = async () => {
    if (!roomName.trim() || !user) return;

    const docRef = await addDoc(collection(db, "chatrooms"), {
      name: roomName.trim(),
      createdBy: displayName,
      createdByUid: user.uid,
      createdAt: serverTimestamp(),
    });

    setSelectedRoomId(docRef.id);
    setRoomName("");
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
    await deleteDoc(doc(db, "chatrooms", roomId));

    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }
  };

  return (
    <main className="mainLayout">
      <aside className="sidebar">
        <h2>Chatrooms</h2>

        <div className="chatroomList">
          {chatrooms.length === 0 ? (
            <p className="emptyText">目前還沒有聊天室</p>
          ) : (
            chatrooms.map((room) => (
              <button
                key={room.id}
                type="button"
                className={
                  selectedRoomId === room.id
                    ? "chatroomCard activeRoom"
                    : "chatroomCard"
                }
                onClick={() => setSelectedRoomId(room.id)}
              >
                <h3>{room.name}</h3>
                <p>Created by {room.createdBy}</p>

                {room.createdByUid === user?.uid && (
                  <span
                    className="deleteRoomButton"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChatroom(room.id);
                    }}
                  >
                    刪除
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {selectedRoom ? (
        <section className="chatPanel">
          <div className="chatHeader">
            <h2>{selectedRoom.name}</h2>
            <p>{displayName}</p>
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
        className="floatingAddButton"
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  createChatroom();
                }
              }}
            />

            <button type="button" onClick={createChatroom}>
              Create
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default ChatPage;