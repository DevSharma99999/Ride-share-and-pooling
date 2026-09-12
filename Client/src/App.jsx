import { useEffect, useState } from "react";
import api from "./api/axios";

function App() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    api.get("/health")
      .then((res) => setStatus(res.data.status))
      .catch(() => setStatus("server unreachable"));
  }, []);

  return <h1>API status: {status}</h1>;
}

export default App;