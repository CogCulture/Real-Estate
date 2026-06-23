import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import NewProject from './pages/NewProject';
import Editor from './pages/Editor';
import Preview3D from './pages/Preview3D';
import RenderStatus from './pages/RenderStatus';
import Admin from './pages/Admin';

function App() {
  return (
    <Router>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px border #334155'
          }
        }}
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new-project" element={<NewProject />} />
        <Route path="/editor/:projectId" element={<Editor />} />
        <Route path="/preview/:projectId" element={<Preview3D />} />
        <Route path="/render/:projectId" element={<RenderStatus />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;
