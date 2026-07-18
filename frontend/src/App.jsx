import { useEffect, useMemo } from "react"
import { useSelector } from "react-redux"
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import Landing from "./pages/Landing"
import LoginSignUp from "./pages/LoginSignUp"
import Dashboard from "./pages/Dashboard"
import MonthlyUpdates from "./pages/MonthlyUpdates"
import AddEmployee from "./pages/AddEmployee"
import ResetPassword from "./pages/ResetPassword"
import NotFound from "./pages/NotFound"

function App() {
  const themeMode = useSelector((state) => state.ui.themeMode);

  // Sync dark class on html document element for Tailwind v4 custom dark variant
  useEffect(() => {
    if (themeMode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [themeMode]);

  // Create MUI theme based on the active theme mode
  const muiTheme = useMemo(() => {
    return createTheme({
      palette: {
        mode: themeMode,
        primary: {
          main: "#3b82f6",
        },
        background: {
          default: themeMode === "dark" ? "#090d16" : "#f3f4f6",
          paper: themeMode === "dark" ? "#111827" : "#ffffff",
        },
      },
    });
  }, [themeMode]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<LoginSignUp />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/monthly-updates" element={<MonthlyUpdates />} />
          <Route path="/add-employee" element={<AddEmployee />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App