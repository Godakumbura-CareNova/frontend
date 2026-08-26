import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh' }}>
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}

export default App;
