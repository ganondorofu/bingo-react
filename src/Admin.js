// Admin.js
import React, { useState } from "react";
import { db } from "./firebase"; // Firestore設定ファイルのインポート
import { doc, setDoc, getDoc, collection, query, where, getDocs, deleteField } from "firebase/firestore";


const Admin = () => {
  const [nextNumber, setNextNumber] = useState("");
  const [message, setMessage] = useState("");

  const settingsDocRef = doc(db, "settings", "nextNumber");
  const numbersCollectionRef = collection(db, "bingoNumbers");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const num = parseInt(nextNumber, 10);
    if (isNaN(num) || num < 1 || num > 75) {
      setMessage("1から75の範囲の有効な番号を入力してください。");
      return;
    }

    try {
      // Firestoreから既に生成された番号を確認
      const q = query(numbersCollectionRef, where("number", "==", num));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setMessage(`番号 ${num} は既に生成されています。別の番号を選択してください。`);
        return;
      }

      // Firestoreに次の番号を保存
      await setDoc(settingsDocRef, { number: num }, { merge: true });
      setMessage(`次の番号として ${num} を設定しました。`);
      setNextNumber("");
    } catch (error) {
      console.error("番号の設定に失敗しました:", error);
      setMessage("番号の設定に失敗しました。再試行してください。");
    }
  };

  const handleClear = async () => {
    try {
      // FirestoreからnextNumberを削除
      await setDoc(settingsDocRef, { number: deleteField() }, { merge: true });
      setMessage("次の番号の設定をクリアしました。");
      setNextNumber("");
    } catch (error) {
      console.error("設定のクリアに失敗しました:", error);
      setMessage("設定のクリアに失敗しました。再試行してください。");
    }
  };

  return (
    <div style={{ backgroundColor: "white", minHeight: "100vh", padding: "20px" }}>
      <form onSubmit={handleSubmit}>
        <label htmlFor="nextNumber">次に出る番号を設定:</label>
        <br />
        <input
          type="number"
          id="nextNumber"
          name="nextNumber"
          value={nextNumber}
          onChange={(e) => setNextNumber(e.target.value)}
          min="1"
          max="75"
          required
        />
        <br />
        <button type="submit">設定</button>
      </form>
      <button onClick={handleClear}>設定をクリア</button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Admin;
