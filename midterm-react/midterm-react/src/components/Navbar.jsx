function Navbar({
  user,
  profile,
  setPage,
  openSignInModal,
  openSignUpModal,
  handleLogout,
}) {
  const displayName = profile.username || profile.email || "Guest";
  const avatarText = displayName.charAt(0).toUpperCase();

  return (
    <header className="navbar">
      <div className="logo" onClick={() => setPage("chat")}>
        Midterm Chatroom
      </div>

      <div className="navRight">
        <button
          type="button"
          className="avatarButton"
          onClick={() => {
            if (user) {
              setPage("profile");
            } else {
              openSignInModal();
            }
          }}
        >
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="profile" />
          ) : (
            <span>{avatarText}</span>
          )}
        </button>

        {user ? (
          <button type="button" onClick={handleLogout}>
            登出
          </button>
        ) : (
          <>
            <button type="button" onClick={openSignInModal}>
              登入
            </button>

            <button type="button" onClick={openSignUpModal}>
              註冊
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;