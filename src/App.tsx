import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { doc, setDoc, collection, query, where, orderBy, limit, onSnapshot, updateDoc, deleteDoc, addDoc, getDoc, getDocs, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { UserRole, Post, Notification, Friendship, UserProfile, Class } from './types';
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
  Home,
  UserCheck,
  UserPlus,
  Eye,
  CheckCircle2,
  Send,
  MessageCircle,
  Plus,
  Check,
  Ghost
} from 'lucide-react';
import { format } from 'date-fns';

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
import Confessions from './pages/Confessions';

const Sidebar = () => {
  const { profile } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/lessons', icon: <BookOpen size={20} />, label: 'Lessons' },
    { to: '/assignments', icon: <ClipboardList size={20} />, label: 'Assignments' },
    { to: '/calendar', icon: <Calendar size={20} />, label: 'Calendar' },
    { to: '/chat', icon: <MessageSquare size={20} />, label: 'Messages' },
    { to: '/confessions', icon: <Ghost size={20} />, label: 'Confessions' },
    { to: '/quiz-history', icon: <Trophy size={20} />, label: 'Quiz History' },
    { to: '/profile', icon: <User size={20} />, label: 'My Profile' },
  ];

  if (profile?.role === 'teacher') {
    links.splice(1, 0, { to: '/classes', icon: <LayoutGrid size={20} />, label: 'My Classes' });
    links.splice(2, 0, { to: '/insights', icon: <TrendingUp size={20} />, label: 'Teacher Insights' });
  }

  return (
    <aside className="w-64 glass-light border-r border-slate-200 h-screen sticky top-0 hidden lg:flex flex-col z-40 gpu-accel">
      <div className="p-6">
        <div className="flex items-center gap-2 text-indigo-600 mb-8 neon-glow-indigo">
          <GraduationCap size={32} strokeWidth={2.5} />
          <span className="text-2xl font-bold tracking-tighter font-display">BISonline</span>
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
    { to: '/confessions', icon: <Ghost size={24} />, label: 'Confessions' },
    { to: '/chat', icon: <MessageSquare size={24} />, label: 'Chat' },
    { to: '/profile', icon: <User size={24} />, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-light border-t border-slate-100 flex justify-around items-center h-14 z-50 lg:hidden pb-safe">
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
  const navigate = useNavigate();
  const location = useLocation();
  const isConfessions = location.pathname === '/confessions';
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<Class[]>([]);
  const [showClassSelector, setShowClassSelector] = useState<{ userId: string, userName: string } | null>(null);

  useEffect(() => {
    if (profile?.role === 'teacher') {
      const q = query(collection(db, 'classes'), where('teacherId', '==', profile.uid));
      getDocs(q).then(snap => {
        setTeacherClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
      });
    }
  }, [profile?.uid, profile?.role]);

  useEffect(() => {
    const search = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const q = query(
          collection(db, 'users'),
          orderBy('displayName'),
          where('displayName', '>=', searchQuery),
          where('displayName', '<=', searchQuery + '\uf8ff'),
          limit(5)
        );
        const snap = await getDocs(q);
        setSearchResults(snap.docs.map(d => d.data() as UserProfile).filter(u => u.uid !== profile?.uid));
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, profile?.uid]);

  const handleAddStudentToClass = async (studentId: string, classId: string, className: string) => {
    try {
      await updateDoc(doc(db, 'users', studentId), {
        classIds: arrayUnion(classId)
      });
      alert(`Added student to ${className}`);
      setShowClassSelector(null);
      setSearchQuery('');
    } catch (err) {
       console.error(err);
    }
  };

  useEffect(() => {
    if (!profile?.uid || !isOnline) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.isRead).length);
    });
    return () => unsubscribe();
  }, [profile?.uid, isOnline]);

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
    }

    if (notif.type === 'new_post' && notif.postId) {
      const postSnap = await getDoc(doc(db, 'posts', notif.postId));
      if (postSnap.exists()) {
        setSelectedPost({ id: postSnap.id, ...postSnap.data() } as Post);
      }
    } else if (notif.link) {
      navigate(notif.link);
      setShowNotifications(false);
    }
  };

  const handleAcceptFriend = async (notif: Notification) => {
    try {
      const friendshipId = profile?.uid < notif.authorId ? `${profile?.uid}_${notif.authorId}` : `${notif.authorId}_${profile?.uid}`;
      await updateDoc(doc(db, 'friends', friendshipId), { status: 'accepted' });
      await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
      
      // Notify them back
      await addDoc(collection(db, 'notifications'), {
        userId: notif.authorId,
        type: 'post_liked', // Using as general activity
        authorId: profile?.uid,
        authorName: profile?.displayName,
        authorPhoto: profile?.photoURL,
        text: `${profile?.displayName} accepted your friend request!`,
        isRead: false,
        createdAt: serverTimestamp(),
        link: `/profile?userId=${profile?.uid}`
      });
      
      alert('You are now friends!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineFriend = async (notif: Notification) => {
    try {
      if (notif.type === 'friend_request') {
        const friendshipId = profile?.uid < notif.authorId ? `${profile?.uid}_${notif.authorId}` : `${notif.authorId}_${profile?.uid}`;
        await deleteDoc(doc(db, 'friends', friendshipId));
      }
      await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
      alert('Request declined.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptClassJoin = async (notif: Notification) => {
    if (!notif.classId) return;
    try {
      await updateDoc(doc(db, 'users', notif.authorId), {
        classIds: arrayUnion(notif.classId)
      });
      await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
      
      // Notify student
      await addDoc(collection(db, 'notifications'), {
        userId: notif.authorId,
        type: 'class_accepted', 
        authorId: profile?.uid,
        authorName: profile?.displayName,
        authorPhoto: profile?.photoURL,
        text: `Your request to join ${notif.className} has been accepted!`,
        isRead: false,
        createdAt: serverTimestamp(),
        link: '/profile'
      });
      
      alert('Student added to class!');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className={`fixed top-0 left-0 right-0 h-14 glass-light border-b transition-all duration-500 z-50 ${isConfessions ? 'border-pink-500/30 ring-1 ring-pink-500/10' : 'border-indigo-500/30'}`}>
      <div className="max-w-[1240px] mx-auto h-full flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link to="/" className={`flex items-center gap-2 transition-all duration-500 ${isConfessions ? 'text-pink-500 neon-glow-pink' : 'text-indigo-600 neon-glow-indigo'}`}>
            <GraduationCap size={28} strokeWidth={2.5} />
            <span className="hidden sm:inline text-xl font-black tracking-tighter font-display">BISonline</span>
          </Link>
        </div>

      <div className="flex-1 max-w-md px-4 relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search BISonline..."
            className="w-full bg-slate-100 border-none rounded-full py-1.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
          />
        </div>

        {/* Search Results Dropdown */}
        <AnimatePresence>
          {searchQuery.trim().length >= 2 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-4 bg-white mt-1 w-[calc(100%-32px)] border border-slate-100 rounded-2xl shadow-2xl z-[150] overflow-hidden"
            >
              <div className="max-h-[300px] overflow-y-auto">
                {searching ? (
                  <div className="p-8 text-center">
                    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Searching...</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">No members found.</div>
                ) : (
                  searchResults.map(user => (
                    <div key={user.uid} className="p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between group">
                      <div 
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => {
                          navigate(`/profile?userId=${user.uid}`);
                          setSearchQuery('');
                        }}
                      >
                        <img src={user.photoURL || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded-full border border-slate-200" alt="" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{user.displayName}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{user.role}</p>
                        </div>
                      </div>
                      {profile?.role === 'teacher' && user.role === 'student' && (
                        <button 
                          onClick={() => setShowClassSelector({ userId: user.uid, userName: user.displayName || 'Student' })}
                          className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        >
                          Add to Class
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Class Selector for Teacher */}
        <AnimatePresence>
          {showClassSelector && (
            <div className="fixed inset-0 flex items-center justify-center z-[200] p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowClassSelector(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-slate-100"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Add Student to Class</h3>
                    <p className="text-lg font-black text-slate-900">{showClassSelector.userName}</p>
                  </div>
                  <button onClick={() => setShowClassSelector(null)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-all">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-3">
                  {teacherClasses.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4 italic">You haven't created any classes yet.</p>
                  ) : (
                    teacherClasses.map(cls => (
                      <button 
                        key={cls.id}
                        onClick={() => handleAddStudentToClass(showClassSelector.userId, cls.id, cls.name)}
                        className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-2xl text-left flex items-center justify-between group transition-all"
                      >
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600">{cls.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{cls.inviteCode}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <Check size={18} />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 relative">
        <button 
          onClick={() => setShowNotifications(!showNotifications)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[8px] text-white flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </button>

        <AnimatePresence>
          {showNotifications && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100]"
            >
              <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Friend Activities</h3>
                <button 
                  onClick={async () => {
                     const unread = notifications.filter(n => !n.isRead);
                     for (const n of unread) {
                       await updateDoc(doc(db, 'notifications', n.id), { isRead: true });
                     }
                  }}
                  className="text-[9px] font-black text-indigo-600 uppercase hover:underline"
                >
                  Mark all as read
                </button>
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bell size={20} className="text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-400 italic">No new notifications.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${n.isRead ? 'opacity-60' : 'bg-indigo-50/20'}`}
                    >
                      <div className="shrink-0 pt-1">
                        <img src={n.authorPhoto || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full object-cover border border-slate-200" alt="" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 leading-snug">
                          <span className="font-bold text-slate-900">{n.authorName}</span> {n.text.replace(n.authorName, '')}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">
                          {n.createdAt ? format(n.createdAt.toDate(), 'MMM d, h:mm a') : 'Now'}
                        </p>
                        {n.type === 'friend_request' && !n.isRead && (
                          <div className="flex gap-2 mt-2">
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleAcceptFriend(n);
                               }}
                               className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-1 shadow-md shadow-indigo-100"
                             >
                               <UserCheck size={10} /> Accept
                             </button>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleDeclineFriend(n);
                               }}
                               className="px-3 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-slate-50"
                             >
                               Decline
                             </button>
                          </div>
                        )}
                        {n.type === 'class_join_request' && !n.isRead && (
                          <div className="flex gap-2 mt-2">
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleAcceptClassJoin(n);
                               }}
                               className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-1 shadow-md shadow-indigo-100"
                             >
                               <Check size={10} /> Accept
                             </button>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleDeclineFriend(n); // Can reuse decline logic since it just deletes and marks read
                               }}
                               className="px-3 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-slate-50"
                             >
                               Decline
                             </button>
                          </div>
                        )}
                      </div>
                      {!n.isRead && <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2 shrink-0"></div>}
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 bg-slate-50 text-center">
                 <Link 
                   to="/" 
                   onClick={() => setShowNotifications(false)}
                   className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all"
                 >
                   Clear all cleared
                 </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
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

      {/* Post Popup Modal */}
      <AnimatePresence>
        {selectedPost && (
          <div className="fixed inset-0 flex items-center justify-center z-[200] p-4">
             <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPost(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <img src={selectedPost.photoURL || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full object-cover" alt="" />
                    <div>
                       <h4 className="text-sm font-bold text-slate-900">{selectedPost.authorName}</h4>
                       <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Status Update</p>
                    </div>
                 </div>
                 <button 
                  onClick={() => setSelectedPost(null)}
                  className="p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-8">
                 <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedPost.text}</p>
              </div>
              <div className="p-6 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                 <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-indigo-600 transition-all">
                       <TrendingUp size={16} /> Heart
                    </button>
                    <button className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-indigo-600 transition-all">
                       <MessageSquare size={16} /> Comment
                    </button>
                 </div>
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                    {selectedPost.createdAt ? format(selectedPost.createdAt.toDate(), 'MMM d, h:mm a') : 'Recent'}
                 </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </header>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading, signIn, logout, completeOnboarding } = useAuth();
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingRole, setOnboardingRole] = useState<UserRole>('student');
  const [onboardingInvite, setOnboardingInvite] = useState('');

  const [dismissLoader, setDismissLoader] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setDismissLoader(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setDismissLoader(false);
    }
  }, [loading]);

  if (loading && !dismissLoader) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 z-[9999]">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"
      />
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Initializing BISonline...</p>
      <button 
        onClick={() => setDismissLoader(true)}
        className="mt-8 text-[10px] font-black text-slate-300 hover:text-indigo-600 transition-all uppercase tracking-[0.2em] flex items-center gap-2"
      >
        <X size={14} /> Bypass Loading
      </button>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;

  // Onboarding UI if profile doesn't exist or role is missing
  if (!profile || !profile.role) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-slate-100"
      >
        <h2 className="text-2xl font-black text-slate-900 mb-2">Welcome to BISonline</h2>
        <p className="text-slate-500 text-sm mb-8 font-medium">Please set up your profile to continue.</p>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setOnboardingRole('student')}
              className={`p-4 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-3 ${
                onboardingRole === 'student' 
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-100' 
                  : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className={`p-3 rounded-xl ${onboardingRole === 'student' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>
                <GraduationCap size={24} />
              </div>
              <span className={`text-xs font-black uppercase tracking-widest ${onboardingRole === 'student' ? 'text-indigo-600' : 'text-slate-400'}`}>Student</span>
            </button>

            <button 
              onClick={() => setOnboardingRole('teacher')}
              className={`p-4 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-3 ${
                onboardingRole === 'teacher' 
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-100' 
                  : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className={`p-3 rounded-xl ${onboardingRole === 'teacher' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>
                <User size={24} />
              </div>
              <span className={`text-xs font-black uppercase tracking-widest ${onboardingRole === 'teacher' ? 'text-indigo-600' : 'text-slate-400'}`}>Teacher</span>
            </button>
          </div>

          <div className="space-y-4">
            {!profile?.displayName && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Display Name</label>
                <input 
                  type="text" 
                  value={onboardingName} 
                  onChange={e => setOnboardingName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all font-medium text-slate-700"
                  placeholder="Enter your name"
                />
              </div>
            )}
            
            {onboardingRole === 'student' && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Class Invite Code</label>
                <input 
                  type="text" 
                  value={onboardingInvite}
                  onChange={e => setOnboardingInvite(e.target.value)}
                  placeholder="CODE123"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all font-mono uppercase text-center text-lg tracking-widest"
                />
                <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-tight text-center">Ask your teacher for the 6-digit code.</p>
              </div>
            )}
          </div>

          <button 
            onClick={() => {
               completeOnboarding(onboardingName || profile?.displayName || '', onboardingRole, onboardingRole === 'student' ? onboardingInvite : undefined);
            }}
            disabled={!onboardingRole || (!onboardingName && !profile?.displayName)}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 mt-4 active:scale-95"
          >
            Finalize My Account
          </button>
        </div>
      </motion.div>
    </div>
  );
  
  const isConfessions = location.pathname === '/confessions';

  return (
    <div className={`flex min-h-screen h-screen overflow-hidden transition-colors duration-500 ${isConfessions ? 'confessions-theme' : 'bg-[#F0F2F5]'}`}>
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden pt-14">
        <Navbar />
        <main className="flex-1 overflow-y-auto w-full max-w-[1200px] mx-auto px-4 pt-4 pb-20 md:pb-8 custom-scrollbar relative z-10 gpu-accel">
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
            <Route path="/confessions" element={<ProtectedRoute><Confessions /></ProtectedRoute>} />
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
