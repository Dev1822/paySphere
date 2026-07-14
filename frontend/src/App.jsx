import { BrowserRouter, Routes, Route } from "react-router-dom"
import Landing from "./pages/Landing"
import LoginSignUp from "./pages/LoginSignUp"
import Dashboard from "./pages/Dashboard"
import MonthlyUpdates from "./pages/MonthlyUpdates"
import AddEmployee from "./pages/AddEmployee"
import ResetPassword from "./pages/ResetPassword"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<LoginSignUp />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/monthly-updates" element={<MonthlyUpdates />} />
        <Route path="/add-employee" element={<AddEmployee />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
      </Routes>


    </BrowserRouter>
  )
}

export default App