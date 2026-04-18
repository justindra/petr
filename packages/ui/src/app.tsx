import { Navigate, Route, Routes } from 'react-router-dom';
import { CompareView } from './pages/compare-view';
import { RunView } from './pages/run-view';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/run" replace />} />
      <Route path="/run" element={<RunView />} />
      <Route path="/run/rows/:rowId" element={<RunView />} />
      <Route path="/compare" element={<CompareView />} />
      <Route path="/compare/rows/:rowId" element={<CompareView />} />
    </Routes>
  );
}
