import { useEffect, useState } from "react";
import "./App.css";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import Navbar from "./components/Navbar";
import AuthModal from "./components/AuthModal";
import ChatPage from "./pages/ChatPage";
import ProfilePage from "./pages/ProfilePage";

function App() {
  const [page, setPage] = useState("chat");
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [profile, setProfile] = useState({
    photoURL: "",
    username: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const ref = doc(db, "profiles", currentUser.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          const newProfile = {
            photoURL: "",
            username: "",
            email: currentUser.email,
            phone: "",
            address: "",
          };
          await setDoc(ref, newProfile);
          setProfile(newProfile);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <Navbar
        user={user}
        profile={profile}
        setPage={setPage}
        setShowAuthModal={setShowAuthModal}
      />

      {page === "chat" ? (
        <ChatPage profile={profile} />
      ) : (
        <ProfilePage
          user={user}
          profile={profile}
          setProfile={setProfile}
          setPage={setPage}
        />
      )}

      {showAuthModal && (
        <AuthModal
          setShowAuthModal={setShowAuthModal}
        />
      )}
    </div>
  );
}

export default App;