import { Routes, Route } from "react-router-dom";
import { ServerList } from "./pages/ServerList";
import { ServerDetail } from "./pages/server/ServerDetail";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-850 text-gray-100">
      <Routes>
        <Route path="/" element={<ServerList />} />
        <Route path="/servers/:id/*" element={<ServerDetail />} />
      </Routes>
    </div>
  );
}