import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Landing from './pages/Landing';
import Home from './pages/Home';
import NewProject from './pages/NewProject';
import Editor from './pages/Editor';
import RenderStatus from './pages/RenderStatus';
import Admin from './pages/Admin';
import Maps from './pages/Maps';

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
        <Route path="/" element={<Landing />} />
        <Route path="/projects" element={<Home />} />
        <Route path="/new-project" element={<NewProject />} />
        <Route path="/editor/:projectId" element={<Editor />} />
        <Route path="/render/:projectId" element={<RenderStatus />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/maps" element={<Maps />} />
      </Routes>
    </Router>
  );
}

export default App;
