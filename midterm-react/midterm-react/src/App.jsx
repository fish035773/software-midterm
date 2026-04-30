import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";

function App() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");

  const handleSignUp = async () => {
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      setUser(result.user);
      setMessage("註冊成功！");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSignIn = async () => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      setMessage("登入成功！");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setMessage("已登出");
  };

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Midterm Chatroom</h1>

      {user ? (
        <div>
          <p>目前登入：{user.email}</p>
          <button onClick={handleLogout}>登出</button>
        </div>
      ) : (
        <div>
          <h2>{mode === "signin" ? "Sign In" : "Sign Up"}</h2>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <br />
          <br />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <br />
          <br />

          {mode === "signin" ? (
            <button onClick={handleSignIn}>登入</button>
          ) : (
            <button onClick={handleSignUp}>註冊</button>
          )}

          <br />
          <br />

          <button
            onClick={() =>
              setMode(mode === "signin" ? "signup" : "signin")
            }
          >
            切換到 {mode === "signin" ? "註冊" : "登入"}
          </button>
        </div>
      )}

      <p>{message}</p>
    </div>
  );
}

export default App;