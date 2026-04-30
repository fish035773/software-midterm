import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase";

function AuthModal({ setShowAuthModal }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleSignUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setShowAuthModal(false);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowAuthModal(false);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <div className="modalOverlay">
      <div className="authModal">
        <button onClick={() => setShowAuthModal(false)}>X</button>

        <h2>{mode === "signin" ? "登入" : "註冊"}</h2>

        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === "signin" ? (
          <button onClick={handleSignIn}>登入</button>
        ) : (
          <button onClick={handleSignUp}>註冊</button>
        )}

        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          切換
        </button>

        <p>{msg}</p>
      </div>
    </div>
  );
}

export default AuthModal;