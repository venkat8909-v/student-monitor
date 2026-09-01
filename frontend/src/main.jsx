import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import StudentPage from './pages/StudentPage'
import DashboardPage from './pages/DashboardPage'
import StudentViewPage from './pages/StudentViewPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<StudentPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/student-view" element={<StudentViewPage />} />
    </Routes>
  </BrowserRouter>
)
