import { useState } from "react";
import axios from "axios";

function App() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔹 Analyze Resume + JD
  const handleSubmit = async () => {
    if (!file || !jd) {
      alert("Please upload resume and paste JD");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("resume", file);
    formData.append("jd", jd);

    try {
      const res = await axios.post(
        "https://studious-fishstick-9jpq44g4pjr2pjg9-3000.app.github.dev/analyze", // ⚠️ replace with Codespaces URL if needed
        formData
      );

      setResult(res.data);
    } catch (err) {
      console.error(err);
      alert("Error analyzing resume");
    }

    setLoading(false);
  };

  // 🔹 Fetch History
  const fetchHistory = async () => {
    try {
      const res = await axios.get(
        "https://studious-fishstick-9jpq44g4pjr2pjg9-5173.app.github.dev/history" // ⚠️ replace with Codespaces URL if needed
      );
      setHistory(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch history");
    }
  };

  return (
    <div style={{ padding: "30px", fontFamily: "Arial" }}>
      <h1>ApplyWise AI</h1>

      {/* 📄 Upload Resume */}
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <br /><br />

      {/* 📝 JD Input */}
      <textarea
        rows="10"
        cols="60"
        placeholder="Paste Job Description"
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />
      <br /><br />

      {/* 🚀 Buttons */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      <br /><br />

      <button onClick={fetchHistory} disabled={loading}>
        View History
      </button>

      {/* 📊 Results */}
      {result && (
        <div style={{ marginTop: "30px" }}>
          <h2>Results</h2>

          <h3>Fit Score: {result.fit_score}</h3>

          {result.apply && (
            <p>
              <strong>Apply:</strong> {result.apply} ({result.confidence})
            </p>
          )}

          {result.embedding_score && (
            <p>
              <strong>Embedding Score:</strong> {result.embedding_score}
            </p>
          )}

          <h4>Missing Skills:</h4>
          <ul>
            {result.missing_skills?.map((skill, i) => (
              <li key={i}>{skill}</li>
            ))}
          </ul>

          <h4>Suggestions:</h4>
          <ul>
            {result.suggestions?.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 📜 History */}
      {history.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h2>History</h2>

          {history.map((item, index) => (
            <div
              key={index}
              style={{
                border: "1px solid #ccc",
                padding: "10px",
                marginBottom: "10px",
                borderRadius: "5px",
              }}
            >
              <p><strong>Score:</strong> {item.fit_score}</p>
              <p><strong>Apply:</strong> {item.apply_decision}</p>
              <p><strong>Confidence:</strong> {item.confidence}</p>
              <p>
                <strong>Date:</strong>{" "}
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;