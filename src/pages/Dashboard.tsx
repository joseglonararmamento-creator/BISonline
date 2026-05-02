import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Lesson, Assignment, Submission, Reminder, UserProfile, Post } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { BookOpen, ClipboardList, CheckCircle2, Clock, ArrowRight, TrendingUp, AlertCircle, MessageSquare, CloudOff, Share2, Megaphone, LayoutDashboard, User, MessageCircle, ExternalLink, X, Plus, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import ShareModal from '../components/ShareModal';

export default function Dashboard() {
  const { profile, isOnline, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [interactions, setInteractions] = useState<{ [key: string]: { hearts: number, comments: any[] } }>({});
  const [newPostText, setNewPostText] = useState('');
  const [publishing, setPublishing] = useState(false);

  const handlePostUpdate = async () => {
    if (!profile || !newPostText.trim()) return;
    setPublishing(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: profile.uid,
        authorName: profile.displayName,
        photoURL: profile.photoURL,
        text: newPostText,
        createdAt: serverTimestamp(),
        likes: 0
      });
      setNewPostText('');
    } catch (err) {
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.role && !authLoading) {
        setLoading(false);
        return;
      }

      try {
        if (isOnline && profile?.role) {
          // Fetch Lessons
          const lessonsSnap = await getDocs(query(collection(db, 'lessons'), limit(5), orderBy('createdAt', 'desc')));
          setLessons(lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)));

          // Fetch Assignments
          const assignmentsSnap = await getDocs(query(collection(db, 'assignments'), limit(3), orderBy('deadline', 'asc')));
          setAssignments(assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));

          // Fetch Submissions
          const subsQuery = profile.role === 'teacher' 
            ? query(collection(db, 'submissions'), limit(5), orderBy('submittedAt', 'desc'))
            : query(collection(db, 'submissions'), where('studentId', '==', profile.uid), limit(5), orderBy('submittedAt', 'desc'));
          const subsSnap = await getDocs(subsQuery);
          setRecentSubmissions(subsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));

          // Fetch Reminders
          let remindersQuery;
          if (profile.role === 'student' && profile.classIds && profile.classIds.length > 0) {
            remindersQuery = query(collection(db, 'reminders'), where('classId', 'in', profile.classIds), orderBy('createdAt', 'desc'), limit(3));
          } else if (profile.role === 'teacher') {
            remindersQuery = query(collection(db, 'reminders'), where('teacherId', '==', profile.uid), orderBy('createdAt', 'desc'), limit(3));
          }
          if (remindersQuery) {
            const remindersSnap = await getDocs(remindersQuery);
            setReminders(remindersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
          }
        } else if (!isOnline) {
          const keys = await localforage.keys();
          const stored: Lesson[] = [];
          for (const key of keys.slice(0, 3)) {
            const lesson = await localforage.getItem<Lesson>(key);
            if (lesson) stored.push(lesson);
          }
          setLessons(stored);
          setOfflineCount(keys.length);
        }
      } catch (error) {
        console.error("Dashboard data fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (profile && !authLoading) fetchData();
  }, [profile, isOnline, authLoading]);

  // Real-time online users listener
  useEffect(() => {
    if (!isOnline) return;
    const q = query(collection(db, 'users'), where('isOnline', '==', true), limit(10));
    const unsubscribe = onSnapshot(q, (snap) => {
      const users = snap.docs
        .map(d => d.data() as UserProfile)
        .filter(u => u.uid !== profile?.uid); // Exclude self
      setOnlineUsers(users);
    });
    return () => unsubscribe();
  }, [isOnline, profile?.uid]);

  // Real-time posts listener
  useEffect(() => {
    if (!isOnline) return;
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
    });
    return () => unsubscribe();
  }, [isOnline]);

  if (loading || authLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-pulse text-indigo-600 font-medium">Loading your dashboard...</div>
    </div>
  );

  if (!profile?.role) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
          <User size={40} className="text-indigo-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Select Your Role</h2>
        <p className="text-slate-500 mb-8 max-w-xs">Please complete your profile setup to access the dashboard features.</p>
        <button 
          onClick={() => navigate('/onboarding')}
          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100"
        >
          Complete Setup
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative min-h-screen pb-20">
      {/* Feed Column */}
      <div className="flex-1 max-w-[700px] mx-auto w-full space-y-6">
        {/* Mobile Teacher Tools */}
        {profile?.role === 'teacher' && (
          <div className="lg:hidden bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-lg p-4 text-white flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest">Professor Panel</h3>
              <p className="text-xs font-bold text-indigo-100">Manage your virtual classrooms</p>
            </div>
            <button 
              onClick={() => navigate('/classes')}
              className="px-4 py-2 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95"
            >
              <Plus size={14} className="inline mr-1" /> Create Class
            </button>
          </div>
        )}

        {/* What's Latest Box (Standalone Status Box) - Social Media Main Feature */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.15em] mb-1">What's Latest, Teacher?</h3>

          <div className="flex items-start gap-4">
            <img src={profile?.photoURL || 'https://via.placeholder.com/48'} className="w-12 h-12 rounded-full border-2 border-indigo-50" alt="Me" />
            <div className="flex-1 space-y-3">
              <textarea 
                value={newPostText}
                onChange={e => setNewPostText(e.target.value)}
                placeholder="Share an update, status, or announcement..."
                className="w-full min-h-[80px] p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-700 text-sm resize-none transition-all"
              />
              <div className="flex justify-end">
                <button 
                  onClick={handlePostUpdate}
                  disabled={publishing || !newPostText.trim()}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center gap-2 hover:bg-indigo-700 transition-all"
                >
                  {publishing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={14} />}
                  Post Update
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Combined Feed (Posts + Lessons) */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <motion.div 
                key={post.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img src={post.photoURL || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full object-cover shadow-sm" alt="" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{post.authorName}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        {post.createdAt ? format(post.createdAt.toDate(), 'MMM d, h:mm a') : 'Recently'}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{post.text}</p>
                <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                   <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors">
                      <TrendingUp size={16} />
                      <span className="text-[11px] font-black uppercase tracking-tighter">Heart</span>
                   </button>
                   <button className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors">
                      <MessageSquare size={16} />
                      <span className="text-[11px] font-black uppercase tracking-tighter">Comment</span>
                   </button>
                </div>
              </motion.div>
            ))}

            {lessons.map((lesson) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={lesson.id} 
                className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden"
              >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-inner">B</div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 hover:underline cursor-pointer">BISonline Academic</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1">
                      Post • {lesson.createdAt ? format(lesson.createdAt.toDate(), 'MMM d') : 'Recently'}
                    </p>
                  </div>
                </div>
                <button className="text-slate-400 hover:bg-slate-50 p-2 rounded-full">
                  <ExternalLink size={16} />
                </button>
              </div>
              <div className="px-4 pb-3">
                <h5 className="font-bold text-slate-900 mb-2 text-lg leading-tight">{lesson.title}</h5>
                <p className="text-sm text-slate-600 line-clamp-4 leading-relaxed">{lesson.content}</p>
              </div>
              <div className="aspect-[16/9] bg-slate-50 flex items-center justify-center border-y border-slate-50">
                <BookOpen size={48} className="text-indigo-100" />
              </div>
              <div className="px-4 py-2 flex items-center justify-between border-t border-slate-50">
                <div className="flex items-center -space-x-1">
                  <motion.div 
                    whileHover={{ scale: 1.2 }}
                    className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[8px] text-white ring-2 ring-white cursor-pointer"
                  >❤️</motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.2 }}
                    className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-[8px] text-white ring-2 ring-white cursor-pointer"
                  >👍</motion.div>
                   <motion.div 
                    whileHover={{ scale: 1.2 }}
                    className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-[8px] text-white ring-2 ring-white cursor-pointer"
                  >🙌</motion.div>
                  <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    {interactions[lesson.id]?.hearts || Math.floor(Math.random() * 20)} Reactions
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                   {interactions[lesson.id]?.comments?.length || Math.floor(Math.random() * 5)} Comments
                </span>
              </div>
              <div className="px-2 pb-2 flex items-center gap-2">
                <motion.button 
                  whileTap={{ scale: 1.4 }}
                  onClick={() => handleStatHeart(lesson.id)}
                  className="flex-1 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-bold text-xs flex items-center justify-center gap-2 transition-all active:text-red-500"
                >
                  <TrendingUp size={16} />
                  Heart
                </motion.button>
                <button className="flex-1 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-bold text-xs flex items-center justify-center gap-2 transition-all">
                  <MessageCircle size={16} />
                  Comment
                </button>
              </div>
            </motion.div>
          ))}

          {reminders.map((rem) => (
            <div key={rem.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden p-4">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                    <Megaphone size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Education Update</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{rem.type} • Now</p>
                  </div>
               </div>
               <p className="text-sm text-slate-700 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 italic">"{rem.text}"</p>
            </div>
          ))}
          </AnimatePresence>

          {/* Online Now Box - Always at the bottom of the feed */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Students & Teachers Online Now</h3>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-emerald-600">{onlineUsers.length} Active</span>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
              {onlineUsers.length === 0 && (
                <div className="flex-1 text-center py-4 text-slate-400 text-[10px] uppercase font-bold italic tracking-wider">
                  Gathering active members...
                </div>
              )}
              {onlineUsers.map((u) => (
                <div key={u.uid} className="flex flex-col items-center gap-1 shrink-0 relative group cursor-pointer" onClick={() => setSelectedUser(u)}>
                  <div className="relative">
                    <img src={u.photoURL || 'https://via.placeholder.com/48'} className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover group-hover:scale-105 transition-all" alt="" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></div>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 truncate w-14 text-center">{u.displayName?.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar (Right) */}
      <div className="hidden lg:block w-80 h-fit space-y-6 sticky top-4">
        {/* Create Class Button - High Priority for Teacher */}
        {profile?.role === 'teacher' && (
          <motion.div 
            whileHover={{ y: -4 }}
            className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-2xl shadow-xl shadow-indigo-200 p-6 text-white relative overflow-hidden"
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl" />
            
            <h3 className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
              <Megaphone size={12} className="text-indigo-200" />
              Teacher Command Center
            </h3>
            <p className="text-sm font-bold text-indigo-50 mb-6 leading-tight">Ready to start a new learning space or invite students?</p>
            
            <button 
              onClick={() => navigate('/classes')}
              className="w-full py-4 bg-white text-indigo-700 rounded-xl font-black text-xs uppercase tracking-[0.15em] shadow-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-3 group"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
              Create a Class
            </button>
          </motion.div>
        )}

        {/* Calendar Widget Alternative */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
           <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upcoming Lessons</h3>
              <Link to="/calendar" className="text-[9px] font-black text-indigo-600 uppercase hover:underline">View All</Link>
           </div>
           <div className="space-y-4">
             {lessons.slice(0, 2).map(l => (
               <div key={l.id} className="relative pl-4 border-l-2 border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-600 uppercase mb-0.5">{l.createdAt ? format(l.createdAt.toDate(), 'EEEE') : 'Soon'}</p>
                  <p className="text-xs font-bold text-slate-800 line-clamp-1">{l.title}</p>
               </div>
             ))}
             {lessons.length === 0 && <p className="text-[10px] text-slate-400 italic">No scheduled lessons yet.</p>}
           </div>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-slate-900 rounded-2xl p-4 text-white">
              <p className="text-[9px] font-black text-slate-500 uppercase mb-3">Live Feed</p>
              <div className="flex items-end gap-2">
                 <span className="text-2xl font-black">{posts.length + lessons.length}</span>
                 <TrendingUp size={14} className="text-emerald-400 mb-1" />
              </div>
           </div>
           <div className="bg-white rounded-2xl p-4 border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Online</p>
              <span className="text-2xl font-black text-slate-900">{onlineUsers.length}</span>
           </div>
        </div>
      </div>

      {/* User Interaction Dialog */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xs bg-white rounded-3xl shadow-2xl p-6 border border-slate-100 overflow-hidden"
            >
              <button 
                onClick={() => setSelectedUser(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center mt-4">
                <div className="relative mb-4">
                  <img 
                    src={selectedUser.photoURL || 'https://via.placeholder.com/128'} 
                    className="w-24 h-24 rounded-full border-4 border-indigo-50 shadow-xl object-cover"
                    alt={selectedUser.displayName || ''}
                  />
                  <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full"></div>
                </div>
                
                <h3 className="text-xl font-black text-slate-900 mb-1">{selectedUser.displayName}</h3>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">{selectedUser.role} • Online</p>

                <div className="w-full space-y-3">
                  <button 
                    onClick={() => {
                      // Navigate to profile
                      navigate(`/profile?userId=${selectedUser.uid}`);
                      setSelectedUser(null);
                    }}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                  >
                    <User size={16} />
                    View Profile
                  </button>
                  <button 
                     onClick={() => {
                      // Navigate to chat with user
                      navigate(`/chat?userId=${selectedUser.uid}`);
                      setSelectedUser(null);
                    }}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    <MessageCircle size={16} />
                    Direct Message
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        url={window.location.origin} 
      />
    </div>
  );
}


function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  return (
    <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center mb-4 shadow-inner`}>
        {icon}
      </div>
      <p className="text-slate-500 text-sm font-medium mb-1">{label}</p>
      <h4 className="text-2xl font-black text-slate-900">{value}</h4>
    </div>
  );
}
