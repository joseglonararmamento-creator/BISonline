import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UserRole } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  ClipboardList, 
  Calendar, 
  MessageSquare, 
  LayoutDashboard, 
  LogOut, 
  TrendingUp,
  User,
  GraduationCap,
  Wifi,
  WifiOff,
  Trophy,
  Menu,
  X,
  LayoutGrid,
  Search,
  Bell,
  Home
} from 'lucide-react';

import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import Dashboard from './pages/Dashboard';
import Lessons from './pages/Lessons';
import Assignments from './pages/Assignments';
import QuizPage from './pages/QuizPage';
import Chat from './pages/Chat';
import CalendarPage from './pages/Calendar';
import QuizHistory from './pages/QuizHistory';
import TeacherInsights from './pages/TeacherInsights';
import Profile from './pages/Profile';
import TeacherClasses from './pages/TeacherClasses';



const Sidebar = () => {
  const { profile } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/lessons', icon: <BookOpen size={20} />, label: 'Lessons' },
    { to: '/assignments', icon: <ClipboardList size={20} />, label: 'Assignments' },
    { to: '/calendar', icon: <Calendar size={20} />, label: 'Calendar' },
    { to: '/chat', icon: <MessageSquare size={20} />, label: 'Messages' },
    { to: '/quiz-history', icon: <Trophy size={20} />, label: 'Quiz History' },
    { to: '/profile', icon: <User size={20} />, label: 'My Profile' },
  ];

  if (profile?.role === 'teacher') {
    links.splice(1, 0, { to: '/classes', icon: <LayoutGrid size={20} />, label: 'My Classes' });
    links.splice(2, 0, { to: '/insights', icon: <TrendingUp size={20} />, label: 'Teacher Insights' });
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen sticky top-0 hidden lg:flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-2 text-indigo-600 mb-8">
          <GraduationCap size={32} strokeWidth={2.5} />
          <span className="text-2xl font-bold tracking-tight">BISonline</span>
        </div>
        
        <nav className="space-y-1">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                location.pathname === link.to
                  ? 'bg-indigo-50 text-indigo-600 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-100 italic text-xs text-slate-400">
        Logged in as {profile?.role}
      </div>
    </aside>
  );
};

const MobileNav = () => {
  const { profile } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/', icon: <Home size={24} />, label: 'Home' },
    { to: '/lessons', icon: <BookOpen size={24} />, label: 'Lessons' },
    { to: '/chat', icon: <MessageSquare size={24} />, label: 'Chat' },
    { to: '/profile', icon: <User size={24} />, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around items-center h-14 z-50 md:hidden pb-safe">
      {links.map((link) => {
        const isActive = location.pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to}
            className={`p-2 transition-all ${
              isActive ? 'text-indigo-600' : 'text-slate-400'
            }`}
          >
            {link.icon}
          </Link>
        );
      })}
    </nav>
  );
};

const Navbar = () => {
  const { profile, logout, isOnline } = useAuth();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const location = useLocation();

  const switchRole = async () => {
    if (!profile) return;
    const newRole = profile.role === 'teacher' ? 'student' : 'teacher';
    await setDoc(doc(db, 'users', profile.uid), { role: newRole }, { merge: true });
    window.location.reload(); 
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-50">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-indigo-600">
          <GraduationCap size={28} strokeWidth={2.5} />
          <span className="hidden sm:inline text-xl font-black tracking-tighter">BISonline</span>
        </Link>
      </div>

      <div className="flex-1 max-w-md px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search BISonline..."
            className="w-full bg-slate-100 border-none rounded-full py-1.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-100 italic text-[10px] text-slate-400 uppercase tracking-widest font-black pr-2">
           {profile?.role} 
        </div>

        <Link to="/profile" className="flex items-center">
          <img 
            src={profile?.photoURL || 'https://via.placeholder.com/40'} 
            className="w-8 h-8 rounded-full border border-slate-200"
            alt="Profile"
          />
        </Link>

        <button 
          onClick={logout}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading, signIn, logout, completeOnboarding } = useAuth();
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingRole, setOnboardingRole] = useState<UserRole>('student');
  const [onboardingInvite, setOnboardingInvite] = useState('');

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"
      />
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;

  // Onboarding UI if profile doesn't exist
  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-slate-100"
      >
        <h2 className="text-2xl font-black text-slate-900 mb-6">Complete Your Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Full Name</label>
            <input 
              type="text" 
              value={onboardingName} 
              onChange={e => setOnboardingName(e.target.value)}
              className="w-full p-3 bg-slate-50 border rounded-xl"
              placeholder="Your Name"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">I am a...</label>
            <select 
              value={onboardingRole}
              onChange={e => setOnboardingRole(e.target.value as UserRole)}
              className="w-full p-3 bg-slate-50 border rounded-xl"
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
          {onboardingRole === 'student' && (
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Class Invite Code (Optional)</label>
              <input 
                type="text" 
                value={onboardingInvite}
                onChange={e => setOnboardingInvite(e.target.value)}
                placeholder="ABCDEF"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono uppercase"
              />
              <p className="mt-1 text-[10px] text-slate-400 italic">Ask your teacher for the 6-digit code.</p>
            </div>
          )}
          <button 
            onClick={() => {
               completeOnboarding(onboardingName, onboardingRole, onboardingRole === 'student' ? onboardingInvite : undefined);
            }}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 mt-4"
          >
            Start Learning
          </button>
        </div>
      </motion.div>
    </div>
  );
  
  return (
    <div className="flex bg-[#F0F2F5] h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden pt-14">
        <Navbar />
        <main className="flex-1 overflow-y-auto w-full max-w-[1200px] mx-auto px-4 pt-4 pb-20 md:pb-8 custom-scrollbar">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
};

const Login = () => {
  const { signIn, user } = useAuth();
  const location = useLocation();

  if (user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-100"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
            <GraduationCap size={48} />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Welcome to BISonline</h2>
        <p className="text-slate-500 mb-8">Empowering learning through seamless collaboration and management.</p>
        
        <button 
          onClick={signIn}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 py-3.5 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm hover:shadow-md"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" className="w-5 h-5" alt="Google" />
          Continue with Google
        </button>
        
        <p className="mt-8 text-xs text-slate-400">
          By signing in, you agree to our Terms and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/lessons" element={<ProtectedRoute><Lessons /></ProtectedRoute>} />
            <Route path="/assignments" element={<ProtectedRoute><Assignments /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><TeacherInsights /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><TeacherClasses /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/quiz-history" element={<ProtectedRoute><QuizHistory /></ProtectedRoute>} />
            <Route path="/quiz/:quizId" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AnimatePresence>
      </Router>
    </AuthProvider>
  );
}
