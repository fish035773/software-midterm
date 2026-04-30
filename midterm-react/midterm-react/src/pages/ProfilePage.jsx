import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

function ProfilePage({ user, profile, setProfile, setPage }) {
  const handleChange = (key, value) => {
    setProfile({ ...profile, [key]: value });
  };

  const handleSave = async () => {
    await setDoc(doc(db, "profiles", user.uid), profile);
    alert("已儲存");
  };

  return (
    <div className="profilePage">
      <h2>Profile</h2>

      <input
        placeholder="username"
        value={profile.username}
        onChange={(e) => handleChange("username", e.target.value)}
      />

      <input
        placeholder="photo URL"
        value={profile.photoURL}
        onChange={(e) => handleChange("photoURL", e.target.value)}
      />

      <input
        placeholder="phone"
        value={profile.phone}
        onChange={(e) => handleChange("phone", e.target.value)}
      />

      <input
        placeholder="address"
        value={profile.address}
        onChange={(e) => handleChange("address", e.target.value)}
      />

      <button onClick={handleSave}>儲存</button>
      <button onClick={() => setPage("chat")}>回去</button>
    </div>
  );
}

export default ProfilePage;