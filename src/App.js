// App.js
import React, { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  writeBatch,
  onSnapshot,
  query,
  getDoc,
  setDoc,
  deleteField,
} from "firebase/firestore";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import Admin from "./Admin"; // 管理者設定ページのインポート

const App = () => {
  const [numbers, setNumbers] = useState([]); // 生成済みの番号リスト
  const [currentNumber, setCurrentNumber] = useState(null); // 最新の番号
  const [displayedNumber, setDisplayedNumber] = useState(null); // アニメーション中に表示する番号
  const [remainingNumbers, setRemainingNumbers] = useState([]); // 未生成の番号
  const [isAnimating, setIsAnimating] = useState(false); // アニメーション進行中かどうか
  const [error, setError] = useState(null); // エラーメッセージ

  // isAnimating の最新状態を参照するための useRef
  const isAnimatingRef = useRef(isAnimating);
  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  // Firestoreのコレクション参照
  const numbersCollection = collection(db, "bingoNumbers");
  const settingsDocRef = doc(db, "settings", "nextNumber");

  // BINGO列の優先順位を定義
  const bingoOrder = { B: 1, I: 2, N: 3, G: 4, O: 5 };

  // BINGO列の文字取得関数
  const getBingoLetter = (number) => {
    if (number <= 15) return "B";
    if (number <= 30) return "I";
    if (number <= 45) return "N";
    if (number <= 60) return "G";
    return "O";
  };

  // BINGO列ごとの色
  const bingoColors = {
    B: "#2196F3",
    I: "#4CAF50",
    N: "#FFEB3B",
    G: "#FF9800",
    O: "#9C27B0",
  };

  // リアルタイムリスナーの設定
  useEffect(() => {
    const q = query(numbersCollection);
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const fetchedNumbers = [];
      querySnapshot.forEach((doc) => {
        fetchedNumbers.push(doc.data().number);
      });

      // BINGO順にソート
      fetchedNumbers.sort((a, b) => {
        const letterA = getBingoLetter(a);
        const letterB = getBingoLetter(b);
        if (bingoOrder[letterA] !== bingoOrder[letterB]) {
          return bingoOrder[letterA] - bingoOrder[letterB];
        }
        return a - b;
      });

      setNumbers(fetchedNumbers);
      const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
      const updatedRemaining = allNumbers.filter((num) => !fetchedNumbers.includes(num));
      setRemainingNumbers(updatedRemaining);
      setError(null);

      // Firestoreから次の番号を取得
      const settingsDoc = await getDoc(settingsDocRef);
      if (settingsDoc.exists()) {
        const nextNumber = settingsDoc.data().number;
        if (nextNumber && updatedRemaining.includes(nextNumber)) {
          setCurrentNumber(nextNumber);
          if (isAnimatingRef.current) {
            setDisplayedNumber(nextNumber);
          }
          setRemainingNumbers((prev) => prev.filter((num) => num !== nextNumber));
          // FirestoreからnextNumberを削除
          await setDoc(settingsDocRef, { number: deleteField() }, { merge: true });
        }
      } else if (fetchedNumbers.length > 0) {
        const latestNumber = fetchedNumbers[fetchedNumbers.length - 1];
        setCurrentNumber(latestNumber);
      }
    });

    return () => unsubscribe();
  }, []); // isAnimating を依存配列から削除

  // 番号を生成し、Firestoreに保存する関数
  const generateNumber = async () => {
    if (remainingNumbers.length === 0 || isAnimating) return; // すべて生成済みまたはアニメーション中の場合はreturn

    setIsAnimating(true);

    // アニメーション開始: 100msごとにランダムな番号を表示
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
      const randomNum = remainingNumbers[randomIndex];
      setDisplayedNumber(randomNum);
    }, 100);

    // アニメーションの持続時間: 3秒
    const duration = 3000;
    setTimeout(async () => {
      clearInterval(interval);

      let finalNumber;
      const settingsDoc = await getDoc(settingsDocRef);
      if (settingsDoc.exists() && settingsDoc.data().number) {
        finalNumber = settingsDoc.data().number;
        // FirestoreからnextNumberを削除
        await setDoc(settingsDocRef, { number: deleteField() }, { merge: true });
        // 残りの番号から削除
        setRemainingNumbers((prev) => prev.filter((num) => num !== finalNumber));
      } else {
        // ランダムに番号を生成
        const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
        finalNumber = remainingNumbers[randomIndex];
        setRemainingNumbers((prev) => prev.filter((_, i) => i !== randomIndex));
      }

      // Firestoreに生成された番号を追加
      await addDoc(numbersCollection, {
        number: finalNumber,
        timestamp: new Date(),
      });

      setIsAnimating(false);
      setDisplayedNumber(finalNumber);
    }, duration);
  };

  // アニメーション終了後に currentNumber を更新
  useEffect(() => {
    if (!isAnimating && displayedNumber !== null) {
      setCurrentNumber(displayedNumber);
      setDisplayedNumber(null);
    }
  }, [isAnimating, displayedNumber]);

  // Firestoreからデータをリセットする関数
  const resetData = async () => {
    try {
      const querySnapshot = await getDocs(numbersCollection);
      const batch = writeBatch(db);

      querySnapshot.forEach((documentSnapshot) => {
        batch.delete(doc(db, "bingoNumbers", documentSnapshot.id));
      });

      await batch.commit();

      // 初期化
      const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
      setRemainingNumbers(allNumbers);
      setNumbers([]);
      setCurrentNumber(null);
      setDisplayedNumber(null);
      setError(null);

      // FirestoreのsettingsからnextNumberを削除
      await setDoc(settingsDocRef, { number: deleteField() }, { merge: true });

      return { success: true };
    } catch (error) {
      console.error("データのリセットに失敗しました:", error);
      setError("データのリセットに失敗しました。再試行してください。");
      return { success: false, error };
    }
  };

  // ClearPage コンポーネント: /clear パスにアクセスしたときにデータをリセット
  const ClearPage = () => {
    const [status, setStatus] = useState("リセット中...");
    const navigate = useNavigate();

    useEffect(() => {
      const performReset = async () => {
        const result = await resetData();
        if (result.success) {
          setStatus("データを正常にリセットしました。");
        } else {
          setStatus("データのリセットに失敗しました。");
        }
        // 3秒後にホームページにリダイレクト
        setTimeout(() => {
          navigate("/");
        }, 3000);
      };

      performReset();
    }, [navigate]);

    return (
      <div
        style={{
          background: "linear-gradient(135deg, #ffcc00 0%, #ff6600 100%)",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "20px",
          fontFamily: "Arial, sans-serif",
          color: "#333",
        }}
      >
        <h1 style={{ color: "#fff", textShadow: "2px 2px #333" }}>データのリセット</h1>
        <p style={{ color: "#fff", marginTop: "20px" }}>{status}</p>
      </div>
    );
  };

  return (
    <div
      style={{
        // 背景にグラデーションを敷いて雰囲気UP
        background: "linear-gradient(135deg, #ffcc00 0%, #ff6600 100%)",
        minHeight: "100vh",
        textAlign: "center",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        color: "#333",
      }}
    >
      <Routes>
        {/* スタイルありのメインページ */}
        <Route
          path="/"
          element={
            <>
              {/* タイトル部分 */}
              <h1 style={{ marginBottom: "20px", color: "#fff", textShadow: "2px 2px #333" }}>
                BINGO番号生成器
              </h1>

              {/* 最新の番号を大きく表示する部分 */}
              <div
                style={{
                  margin: "0 auto 20px auto",
                  fontSize: "3em",
                  fontWeight: "bold",
                  color: "#ffffff",
                  minHeight: "80px",
                  width: "220px",
                  height: "100px",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.3)",
                  transition: "transform 0.3s ease-in-out, opacity 0.3s ease-in-out",
                  // animateがtrueの場合は拡大表示、それ以外は通常サイズ
                  transform: isAnimating ? "scale(1.3)" : "scale(1)",
                  opacity: isAnimating ? 0.8 : 1,
                  background: "#ff5722",
                }}
              >
                {isAnimating ? (
                  <>
                    <span style={{ marginRight: "10px" }}>{getBingoLetter(displayedNumber)}</span>
                    {displayedNumber}
                  </>
                ) : currentNumber !== null ? (
                  <>
                    <span style={{ marginRight: "10px" }}>{getBingoLetter(currentNumber)}</span>
                    {currentNumber}
                  </>
                ) : (
                  "???"
                )}
              </div>

              {/* 番号を生成するボタン */}
              <button
                onClick={generateNumber}
                style={{
                  padding: "12px 24px",
                  fontSize: "1.2em",
                  backgroundColor: "#2196F3",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: remainingNumbers.length === 0 || isAnimating ? "not-allowed" : "pointer",
                  boxShadow: "0px 3px 5px rgba(0, 0, 0, 0.2)",
                  transition: "background-color 0.3s ease, transform 0.2s",
                  marginBottom: "20px",
                }}
                onMouseEnter={(e) => {
                  if (remainingNumbers.length > 0 && !isAnimating) {
                    e.currentTarget.style.backgroundColor = "#1976D2";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#2196F3";
                  e.currentTarget.style.transform = "scale(1)";
                }}
                disabled={remainingNumbers.length === 0 || isAnimating}
              >
                {remainingNumbers.length === 0
                  ? "番号がすべて生成されました"
                  : isAnimating
                  ? "生成中..."
                  : "番号を生成"}
              </button>

              {/* エラーメッセージの表示 */}
              {error && (
                <p style={{ color: "red", marginTop: "20px" }}>
                  {error}
                </p>
              )}

              {/* 生成済みの番号一覧 */}
              <div style={{ marginTop: "40px" }}>
                <h2 style={{ marginBottom: "10px", color: "#fff", textShadow: "1px 1px #333" }}>
                  生成済みの番号
                </h2>
                {numbers.length === 0 && (
                  <p style={{ color: "#fff" }}>まだ番号は生成されていません</p>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                    gap: "15px",
                    justifyContent: "center",
                    marginTop: "20px",
                    maxWidth: "800px",
                    margin: "20px auto",
                  }}
                >
                  {numbers.map((num, index) => {
                    const letter = getBingoLetter(num);
                    return (
                      <div
                        key={index}
                        style={{
                          width: "80px",
                          height: "80px",
                          lineHeight: "80px",
                          borderRadius: "10px",
                          backgroundColor: bingoColors[letter],
                          fontSize: "1.5em",
                          fontWeight: "bold",
                          color: "#fff",
                          border: "2px solid #333",
                          textAlign: "center",
                          boxShadow: "0px 2px 5px rgba(0, 0, 0, 0.2)",
                          transition: "transform 0.2s, box-shadow 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.1)";
                          e.currentTarget.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.4)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.boxShadow = "0px 2px 5px rgba(0, 0, 0, 0.2)";
                        }}
                      >
                        {letter}-{num}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          }
        />
        {/* ノースタイルページの追加 */}
        <Route
          path="/nostyle"
          element={
            <>
              {/* タイトル部分 */}
              <h1>BINGO番号生成器</h1>

              {/* 最新の番号を表示する部分 */}
              <div>
                {currentNumber !== null ? (
                  <span>
                    {getBingoLetter(currentNumber)}-{currentNumber}
                  </span>
                ) : (
                  "???"
                )}
              </div>

              {/* 番号を生成するボタン */}
              <button onClick={generateNumber} disabled={remainingNumbers.length === 0 || isAnimating}>
                {remainingNumbers.length === 0
                  ? "番号がすべて生成されました"
                  : isAnimating
                  ? "生成中..."
                  : "番号を生成"}
              </button>

              {/* エラーメッセージの表示 */}
              {error && <p>{error}</p>}

              {/* 生成済みの番号一覧 */}
              <div>
                <h2>生成済みの番号</h2>
                {numbers.length === 0 && <p>まだ番号は生成されていません</p>}
                <ul>
                  {numbers.map((num, index) => {
                    const letter = getBingoLetter(num);
                    return (
                      <li key={index}>
                        {letter}-{num}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          }
        />
        {/* 管理者設定ページ */}
        <Route path="/admin" element={<Admin />} />
        {/* データクリアページ */}
        <Route path="/clear" element={<ClearPage />} />
        {/* 不明なルートをホームにリダイレクト */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default App;
