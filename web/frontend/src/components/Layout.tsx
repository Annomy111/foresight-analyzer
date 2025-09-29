import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brain, BarChart3, History, Settings, Github } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-2 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI Foresight Analyzer</h1>
                <p className="text-xs text-gray-500">Wisdom of the Silicon Crowd</p>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-1">
              <NavLink to="/" icon={Brain} isActive={isActive('/')}>
                New Forecast
              </NavLink>
              <NavLink to="/history" icon={History} isActive={isActive('/history')}>
                History
              </NavLink>
              <NavLink to="/models" icon={BarChart3} isActive={isActive('/models')}>
                Models
              </NavLink>
              <NavLink to="/settings" icon={Settings} isActive={isActive('/settings')}>
                Settings
              </NavLink>
            </nav>

            {/* GitHub Link */}
            <a
              href="https://github.com/Annomy111/foresight-analyzer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>AI Foresight Analyzer v2.0 - Implementing "Wisdom of the Silicon Crowd" methodology</p>
            <p className="mt-1">
              Based on research by Schoenegger et al. (2024)
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface NavLinkProps {
  to: string;
  icon: React.ElementType;
  isActive: boolean;
  children: ReactNode;
}

const NavLink = ({ to, icon: Icon, isActive, children }: NavLinkProps) => {
  return (
    <Link
      to={to}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-primary-50 text-primary-700 font-medium'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{children}</span>
    </Link>
  );
};
