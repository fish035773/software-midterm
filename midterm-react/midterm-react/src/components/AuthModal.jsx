import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

function AuthModal({ mode, closeAuthModal }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const handleSignUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      closeAuthModal();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      closeAuthModal();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <div className="modalOverlay">
      <div className="authModal">
        <button
          type="button"
          className="closeButton"
          onClick={closeAuthModal}
        >
          ×
        </button>

        <h2>{mode === "signin" ? "登入" : "註冊"}</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password，至少 6 碼"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === "signin" ? (
          <button type="button" onClick={handleSignIn}>
            登入
          </button>
        ) : (
          <button type="button" onClick={handleSignUp}>
            註冊
          </button>
        )}

        <button type="button" onClick={loginWithGoogle}>
          Sign in with Google
        </button>

        <p>{msg}</p>
      </div>
    </div>
  );
}

export default AuthModal;