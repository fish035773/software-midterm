import { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../firebase";

// ── constants ────────────────────────────────────────────────────────────────

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😢"];

// ── helpers ──────────────────────────────────────────────────────────────────

const roomInviteUrl = (roomId) =>
  `${window.location.origin}${window.location.pathname}?room=${roomId}`;

const pushRoomToUrl = (roomId) =>
  window.history.pushState({}, "", `?room=${roomId}`);

const clearRoomFromUrl = () =>
  window.history.pushState({}, "", window.location.pathname);

const replaceRoomInUrl = (roomId) =>
  roomId
    ? window.history.replaceState({}, "", `?room=${roomId}`)
    : window.history.replaceState({}, "", window.location.pathname);

// ── component ────────────────────────────────────────────────────────────────

function ChatPage({ profile, user, onLoginRequired }) {
  const displayName =
    profile.username ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Guest";

  // rooms & messages
  const [chatrooms, setChatrooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [inviteRoom, setInviteRoom] = useState(null); // room loaded from ?room= URL
  const [messages, setMessages] = useState([]);

  // room creation
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [roomVisibility, setRoomVisibility] = useState("public");
  const [roomPassword, setRoomPassword] = useState("");

  // messaging
  const [messageText, setMessageText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchText, setSearchText] = useState("");

  // private room join
  const [showPasswordBox, setShowPasswordBox] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(null);
  const [joinPassword, setJoinPassword] = useState("");

  // UI state
  const [copied, setCopied] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [showBlockedList, setShowBlockedList] = useState(false);

  // refs
  const lastMessageCountRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  const imageInputRef = useRef(null);
  const messageRefs = useRef({});

  // ── derived state ───────────────────────────────────────────────────────────

  const selectedRoom =
    chatrooms.find((r) => r.id === selectedRoomId) ?? inviteRoom;

  // block maps for the current room
  const roomBlocks = selectedRoom?.blocks ?? {};
  const myBlockedUids = user ? (roomBlocks[user.uid] ?? []) : [];

  // build a display-friendly blocked list by peeking at cached messages
  const blockedUserList = myBlockedUids.map((uid) => ({
    uid,
    name: messages.find((m) => m.senderUid === uid)?.sender ?? uid,
  }));

  // ── role helpers ────────────────────────────────────────────────────────────

  const isRoomOwner = (room) => room.createdByUid === user?.uid;
  const isJoinedRoom = (room) => room.members?.includes(user?.uid);
  const canEnterRoom = (room) => isRoomOwner(room) || isJoinedRoom(room);
  const isMyMessage = (msg) => msg.senderUid === user?.uid;

  // ── visibility helpers ──────────────────────────────────────────────────────

  const isPublicRoom = (room) => room.visibility !== "private";
  const visibilityLabel = (room) => (isPublicRoom(room) ? "Public" : "Private");
  const visibilityBadgeClass = (room) =>
    isPublicRoom(room) ? "roomBadge publicBadge" : "roomBadge privateBadge";

  // ── message filtering ───────────────────────────────────────────────────────

  const filteredMessages = messages
    .filter((msg) => {
      if (!user) return true;
      const iBlocked = myBlockedUids.includes(msg.senderUid);
      const theyBlockedMe = roomBlocks[msg.senderUid]?.includes(user.uid);
      return !iBlocked && !theyBlockedMe;
    })
    .filter((msg) => {
      const kw = searchText.trim().toLowerCase();
      if (!kw) return true;
      return (
        msg.text?.toLowerCase().includes(kw) ||
        msg.sender?.toLowerCase().includes(kw) ||
        msg.replyTo?.text?.toLowerCase().includes(kw) ||
        msg.replyTo?.sender?.toLowerCase().includes(kw)
      );
    });

  // ── effects: chatroom list ──────────────────────────────────────────────────

  useEffect(() => {
    const q = query(collection(db, "chatrooms"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) =>
      setChatrooms(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, []);

  // ── effects: deep-link / invite URL ────────────────────────────────────────

  useEffect(() => {
    const handleInviteLink = async () => {
      const roomIdFromUrl = new URLSearchParams(window.location.search).get("room");
      if (!roomIdFromUrl) return;

      const roomSnap = await getDoc(doc(db, "chatrooms", roomIdFromUrl));
      if (!roomSnap.exists()) {
        replaceRoomInUrl(null);
        return;
      }

      const targetRoom = { id: roomSnap.id, ...roomSnap.data() };
      setSelectedRoomId(targetRoom.id);
      setInviteRoom(targetRoom);

      if (!user) {
        onLoginRequired?.();
        return;
      }

      // auto-join if not already a member
      const isAlreadyMember =
        targetRoom.createdByUid === user.uid ||
        targetRoom.members?.includes(user.uid);

      if (!isAlreadyMember) {
        await updateDoc(doc(db, "chatrooms", targetRoom.id), {
          members: arrayUnion(user.uid),
        });
        setInviteRoom({
          ...targetRoom,
          members: [...(targetRoom.members ?? []), user.uid],
        });
      }
    };

    handleInviteLink();
  }, [user, onLoginRequired]);

  // ── effects: message stream ─────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      lastMessageCountRef.current = 0;
      isInitialLoadRef.current = true;
      return;
    }

    const q = query(
      collection(db, "chatrooms", selectedRoomId, "messages"),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snap) => {
      const roomMessages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(roomMessages);

      const prev = lastMessageCountRef.current;
      const curr = roomMessages.length;

      if (isInitialLoadRef.current) {
        lastMessageCountRef.current = curr;
        isInitialLoadRef.current = false;
        return;
      }

      // push notification for new messages from others while page is hidden
      if (curr > prev) {
        const newest = roomMessages[curr - 1];
        const fromOther = newest.senderUid !== user?.uid;
        const canNotify =
          notificationEnabled &&
          fromOther &&
          document.hidden &&
          "Notification" in window &&
          Notification.permission === "granted";

        if (canNotify) {
          new Notification("你有新的未讀訊息", {
            body: `${newest.sender}: ${
              newest.type === "image" ? "傳送了一張圖片" : newest.text
            }`,
          });
        }
      }

      lastMessageCountRef.current = curr;
    });
  }, [selectedRoomId, user, notificationEnabled]);

  // ── navigation helpers ──────────────────────────────────────────────────────

  const selectRoom = (roomId) => {
    setInviteRoom(null);
    setSelectedRoomId(roomId);
    setSearchText("");
    setReplyTo(null);
    pushRoomToUrl(roomId);
  };

  const backToRoomList = () => {
    setSelectedRoomId(null);
    setInviteRoom(null);
    setSearchText("");
    setReplyTo(null);
    clearRoomFromUrl();
  };

  // ── room actions ────────────────────────────────────────────────────────────

  const joinRoom = async (room) => {
    if (!user) { onLoginRequired?.(); return; }
    if (canEnterRoom(room)) { selectRoom(room.id); return; }

    if (!isPublicRoom(room)) {
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
    const room = chatrooms.find((r) => r.id === roomId);
    if (!room) return;

    if (isRoomOwner(room)) {
      alert("房主不能退出自己的聊天室，只能刪除聊天室");
      return;
    }

    await updateDoc(doc(db, "chatrooms", roomId), {
      members: arrayRemove(user.uid),
    });

    if (selectedRoomId === roomId) backToRoomList();
  };

  const confirmJoinPrivateRoom = async () => {
    if (!joiningRoom || !user) { onLoginRequired?.(); return; }

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
    if (!user) { onLoginRequired?.(); return; }
    if (!roomName.trim()) return;

    const isPrivate = roomVisibility === "private";
    if (isPrivate && !roomPassword.trim()) {
      alert("Private chatroom 需要設定密碼");
      return;
    }

    const newRoomData = {
      name: roomName.trim(),
      description: roomDescription.trim(),
      visibility: roomVisibility,
      password: isPrivate ? roomPassword.trim() : "",
      createdBy: displayName,
      createdByUid: user.uid,
      members: [user.uid],
    };

    const docRef = await addDoc(collection(db, "chatrooms"), {
      ...newRoomData,
      createdAt: serverTimestamp(),
    });

    // optimistically set invite room so UI shows it immediately
    setInviteRoom({ id: docRef.id, ...newRoomData, createdAt: new Date() });
    setSelectedRoomId(docRef.id);
    pushRoomToUrl(docRef.id);

    setRoomName("");
    setRoomDescription("");
    setRoomVisibility("public");
    setRoomPassword("");
    setShowCreateBox(false);
  };

  const deleteChatroom = async (roomId) => {
    if (!window.confirm("確定要刪除這個聊天室嗎？")) return;

    await deleteDoc(doc(db, "chatrooms", roomId));

    if (selectedRoomId === roomId) backToRoomList();

    if (new URLSearchParams(window.location.search).get("room") === roomId) {
      replaceRoomInUrl(null);
    }
  };

  // ── invite link ─────────────────────────────────────────────────────────────

  const copyInviteLink = async () => {
    if (!selectedRoomId) return;
    await navigator.clipboard.writeText(roomInviteUrl(selectedRoomId));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ── notifications ───────────────────────────────────────────────────────────

  const toggleNotification = async () => {
    if (notificationEnabled) {
      setNotificationEnabled(false);
      alert("已關閉聊天室通知");
      return;
    }

    if (!("Notification" in window)) {
      alert("這個瀏覽器不支援 Chrome 通知");
      return;
    }
    if (Notification.permission === "denied") {
      alert("通知被瀏覽器封鎖，請到 Chrome 網站設定裡重新允許通知");
      return;
    }
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { alert("你沒有允許通知"); return; }
    }

    setNotificationEnabled(true);
    alert("已開啟聊天室通知");
  };

  // ── block / unblock ─────────────────────────────────────────────────────────

  const toggleBlockUser = async (uid) => {
    if (!user || !selectedRoomId || !uid) return;

    const isBlocked = myBlockedUids.includes(uid);
    await updateDoc(doc(db, "chatrooms", selectedRoomId), {
      [`blocks.${user.uid}`]: isBlocked
        ? myBlockedUids.filter((id) => id !== uid)
        : [...myBlockedUids, uid],
    });
  };

  const unblockAll = async () => {
    if (!user || !selectedRoomId) return;
    await updateDoc(doc(db, "chatrooms", selectedRoomId), {
      [`blocks.${user.uid}`]: [],
    });
    setShowBlockedList(false);
  };

  // ── reactions ───────────────────────────────────────────────────────────────

  const toggleReaction = async (message, emoji) => {
    if (!user || !selectedRoomId) { onLoginRequired?.(); return; }

    const reactedUids = message.reactions?.[emoji] ?? [];
    const hasReacted = reactedUids.includes(user.uid);

    try {
      await updateDoc(
        doc(db, "chatrooms", selectedRoomId, "messages", message.id),
        {
          [`reactions.${emoji}`]: hasReacted
            ? arrayRemove(user.uid)
            : arrayUnion(user.uid),
        }
      );
    } catch (err) {
      console.error("Reaction update failed:", err);
    }
  };

  // ── reply helpers ───────────────────────────────────────────────────────────

  const buildReplyData = () => {
    if (!replyTo) return null;
    return {
      id: replyTo.id,
      sender: replyTo.sender,
      senderUid: replyTo.senderUid,
      type: replyTo.type ?? "text",
      text: replyTo.type === "image" ? "" : replyTo.text ?? "",
      imageUrl: replyTo.type === "image" ? replyTo.imageUrl ?? "" : "",
    };
  };

  const focusOriginalMessage = (messageId) => {
    if (!messageId) return;
    const el = messageRefs.current[messageId];
    if (!el) { alert("原訊息已被收回或目前不可見"); return; }

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    setTimeout(() => setHighlightedMessageId(null), 1500);
  };

  const replyPreviewText = (msg) =>
    msg.type === "image" ? "圖片" : msg.text;

  // ── messaging ───────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!user) { onLoginRequired?.(); return; }
    if (!messageText.trim() || !selectedRoomId) return;
    if (selectedRoom && !canEnterRoom(selectedRoom)) {
      alert("請先加入聊天室");
      return;
    }

    await addDoc(
      collection(db, "chatrooms", selectedRoomId, "messages"),
      {
        type: "text",
        text: messageText.trim(),
        sender: displayName,
        senderUid: user.uid,
        createdAt: serverTimestamp(),
        edited: false,
        replyTo: buildReplyData(),
        reactions: {},
      }
    );

    setMessageText("");
    setReplyTo(null);
  };

  const sendImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) { onLoginRequired?.(); return; }
    if (!selectedRoomId) return;

    if (!file.type.startsWith("image/")) {
      alert("只能上傳圖片");
      return;
    }
    if (selectedRoom && !canEnterRoom(selectedRoom)) {
      alert("請先加入聊天室");
      return;
    }

    try {
      setUploadingImage(true);
      const safeName = file.name.replace(/[^\w.-]/g, "_");
      const filePath = `chatrooms/${selectedRoomId}/images/${Date.now()}_${safeName}`;
      const imageRef = ref(storage, filePath);

      await uploadBytes(imageRef, file);
      const imageUrl = await getDownloadURL(imageRef);

      await addDoc(
        collection(db, "chatrooms", selectedRoomId, "messages"),
        {
          type: "image",
          text: "",
          imageUrl,
          imagePath: filePath,
          sender: displayName,
          senderUid: user.uid,
          createdAt: serverTimestamp(),
          edited: false,
          replyTo: buildReplyData(),
          reactions: {},
        }
      );

      setReplyTo(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  // ── edit message ────────────────────────────────────────────────────────────

  const startEditMessage = (msg) => {
    if (!isMyMessage(msg)) return;
    if (msg.type === "image") { alert("圖片不能編輯，只能收回"); return; }
    setEditingMessageId(msg.id);
    setEditingText(msg.text ?? "");
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const saveEditedMessage = async (messageId) => {
    if (!editingText.trim()) return;
    await updateDoc(
      doc(db, "chatrooms", selectedRoomId, "messages", messageId),
      { text: editingText.trim(), edited: true, editedAt: serverTimestamp() }
    );
    setEditingMessageId(null);
    setEditingText("");
  };

  // ── unsend message ──────────────────────────────────────────────────────────

  const unsendMessage = async (msg) => {
    if (!isMyMessage(msg)) return;
    if (!window.confirm("確定要收回這則訊息嗎？")) return;

    if (msg.type === "image" && msg.imagePath) {
      try {
        await deleteObject(ref(storage, msg.imagePath));
      } catch (err) {
        console.warn("圖片檔案刪除失敗，但訊息仍會刪除：", err);
      }
    }

    await deleteDoc(
      doc(db, "chatrooms", selectedRoomId, "messages", msg.id)
    );
  };

  // ── message timestamp ───────────────────────────────────────────────────────

  const messageTime = (msg) =>
    msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString() : "";

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <main className="mainLayout">

      {/* ── Sidebar: room list ───────────────────────────────────────────────── */}
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

                  <span className={visibilityBadgeClass(room)}>
                    {visibilityLabel(room)}
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

      {/* ── Chat panel ──────────────────────────────────────────────────────── */}
      {selectedRoom && !user ? (
        <section className="chatPanel emptyChatPanel">
          <h2>請先登入才能加入聊天室</h2>
          <button type="button" className="inviteButton" onClick={onLoginRequired}>
            登入
          </button>
        </section>

      ) : selectedRoom ? (
        <section className="chatPanel showChatOnMobile">

          {/* Header */}
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
              <small>{visibilityLabel(selectedRoom)}</small>
            </div>

            <button type="button" className="inviteButton" onClick={copyInviteLink}>
              {copied ? "已複製" : "複製邀請連結"}
            </button>

            <button
              type="button"
              className={
                notificationEnabled
                  ? "notifyButton notifyButtonOn"
                  : "notifyButton"
              }
              onClick={toggleNotification}
            >
              {notificationEnabled ? "關閉通知" : "開啟通知"}
            </button>
          </div>

          {/* Search */}
          <div className="searchBar">
            <input
              type="text"
              placeholder="搜尋訊息或使用者"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button type="button" onClick={() => setSearchText("")}>
                清除
              </button>
            )}
          </div>

          {/* Message list */}
          <div className="messageArea">
            {filteredMessages.length === 0 ? (
              <p className="emptyText">
                {searchText ? "找不到符合的訊息" : "目前還沒有訊息"}
              </p>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  ref={(el) => { if (el) messageRefs.current[msg.id] = el; }}
                  className={[
                    "messageBubble",
                    isMyMessage(msg) ? "myMessage" : "",
                    highlightedMessageId === msg.id ? "highlightMessage" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <strong>{msg.sender}</strong>

                  {/* Reply preview */}
                  {msg.replyTo && (
                    <button
                      type="button"
                      className="replyPreview"
                      onClick={() => focusOriginalMessage(msg.replyTo.id)}
                    >
                      <span className="replyPreviewLabel">
                        回覆 {msg.replyTo.sender}：
                      </span>
                      <span>{replyPreviewText(msg.replyTo)}</span>
                    </button>
                  )}

                  {/* Message body */}
                  {editingMessageId === msg.id ? (
                    <div className="editMessageBox">
                      <input
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditedMessage(msg.id);
                        }}
                      />
                      <button type="button" onClick={() => saveEditedMessage(msg.id)}>
                        儲存
                      </button>
                      <button type="button" onClick={cancelEditMessage}>
                        取消
                      </button>
                    </div>
                  ) : msg.type === "image" ? (
                    <img
                      className="messageImage"
                      src={msg.imageUrl}
                      alt="聊天圖片"
                    />
                  ) : (
                    <p className="messageText">{msg.text}</p>
                  )}

                  {/* Timestamp */}
                  <small>
                    {messageTime(msg)}
                    {msg.edited ? "（已編輯）" : ""}
                  </small>

                  {/* Reactions */}
                  <div className="reactionBar">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => toggleReaction(msg, emoji)}
                      >
                        {emoji} {msg.reactions?.[emoji]?.length || 0}
                      </button>
                    ))}
                  </div>

                  {/* Message actions */}
                  <div className="messageActions">
                    <button type="button" onClick={() => setReplyTo(msg)}>
                      回覆
                    </button>

                    {!isMyMessage(msg) && (
                      <button
                        type="button"
                        onClick={() => toggleBlockUser(msg.senderUid)}
                      >
                        {myBlockedUids.includes(msg.senderUid)
                          ? "解除封鎖"
                          : "封鎖"}
                      </button>
                    )}

                    {isMyMessage(msg) && editingMessageId !== msg.id && (
                      <>
                        {msg.type !== "image" && (
                          <button
                            type="button"
                            onClick={() => startEditMessage(msg)}
                          >
                            編輯
                          </button>
                        )}
                        <button type="button" onClick={() => unsendMessage(msg)}>
                          收回
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Blocked users bar */}
          {myBlockedUids.length > 0 && (
            <div className="blockedUsersBox">
              <button
                type="button"
                className="blockedListButton"
                onClick={() => setShowBlockedList(true)}
              >
                封鎖名單（{myBlockedUids.length}）
              </button>
            </div>
          )}

          {/* Blocked list modal */}
          {showBlockedList && (
            <div className="modalOverlay">
              <div className="blockedListModal">
                <button
                  type="button"
                  className="closeButton"
                  onClick={() => setShowBlockedList(false)}
                >
                  ×
                </button>

                <h2>封鎖名單</h2>

                {blockedUserList.length === 0 ? (
                  <p className="emptyText">目前沒有封鎖任何使用者</p>
                ) : (
                  <>
                    <div className="blockedUserList">
                      {blockedUserList.map((u) => (
                        <div key={u.uid} className="blockedUserItem">
                          <strong>{u.name}</strong>
                          <button
                            type="button"
                            onClick={() => toggleBlockUser(u.uid)}
                          >
                            解除封鎖
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="unblockAllButton"
                      onClick={unblockAll}
                    >
                      全部解除封鎖
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Reply box */}
          {replyTo && (
            <div className="replyBox">
              <span>
                正在回覆 {replyTo.sender}：{replyPreviewText(replyTo)}
              </span>
              <button type="button" onClick={() => setReplyTo(null)}>
                取消
              </button>
            </div>
          )}

          {/* Input bar */}
          <div className="messageInputBar">
            <input
              placeholder="輸入訊息"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
            />

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hiddenFileInput"
              onChange={sendImage}
            />

            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage}
            >
              {uploadingImage ? "上傳中" : "圖片"}
            </button>

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

      {/* ── FAB: create room ─────────────────────────────────────────────────── */}
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

      {/* ── Modal: create room ───────────────────────────────────────────────── */}
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

      {/* ── Modal: join private room ─────────────────────────────────────────── */}
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
                if (e.key === "Enter") confirmJoinPrivateRoom();
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
