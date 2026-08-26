import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RegisterPage from '../pages/auth/Register';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<Navigate to="/register" replace />} />
      <Route path="*" element={<Navigate to="/register" replace />} />
    </Routes>
  );
};

export default AppRoutes;
