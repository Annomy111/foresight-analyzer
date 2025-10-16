import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { History } from './pages/History';
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/models" element={<ComingSoon page="Models" />} />
            <Route path="/settings" element={<ComingSoon page="Settings" />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

// Placeholder for upcoming pages
const ComingSoon = ({ page }: { page: string }) => {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{page} Coming Soon</h2>
      <p className="text-gray-600">
        This feature is under development and will be available in a future update.
      </p>
    </div>
  );
};

export default App;
