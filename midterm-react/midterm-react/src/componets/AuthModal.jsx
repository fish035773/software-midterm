function ChatPage({ profile }) {
  const displayName = profile.username || profile.email || "Guest";

  return (
    <main className="mainLayout">
      <aside className="sidebar">
        <h2>Chatrooms</h2>
      </aside>

      <section className="chatPanel">
        <div className="chatHeader">
          <h2>Public Chatroom</h2>
          <p>{displayName}</p>
        </div>

        <div className="messageArea">
          <p>這裡會放訊息</p>
        </div>

        <div className="messageInputBar">
          <input placeholder="輸入訊息" />
          <button>送出</button>
        </div>
      </section>
    </main>
  );
}

export default ChatPage;