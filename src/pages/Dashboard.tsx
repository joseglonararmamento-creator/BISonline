import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Lesson, Assignment, Submission, Reminder, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { BookOpen, ClipboardList, CheckCircle2, Clock, ArrowRight, TrendingUp, AlertCircle, MessageSquare, CloudOff, Share2, Megaphone, LayoutDashboard, User, MessageCircle, ExternalLink, X, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import ShareModal from '../components/ShareModal';

export default function Dashboard() {
  const { profile, isOnline } = useAuth();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [dairies, setDairies] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<{ [key: string]: { hearts: number, comments: any[] } }>({});
  const [newDairyText, setNewDairyText] = useState('');
  const [showDiaryComposer, setShowDiaryComposer] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handlePostDairy = async () => {
    if (!profile || !newDairyText.trim()) return;
    setPublishing(true);
    try {
      await addDoc(collection(db, 'dairies'), {
        authorId: profile.uid,
        authorName: profile.displayName,
        photoURL: profile.photoURL,
        text: newDairyText,
        createdAt: serverTimestamp()
      });
      setNewDairyText('');
      // Refresh logic would ideally use onSnapshot, but we already have a 24h filter
    } catch (err) {
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  const handleStatHeart = async (lessonId: string) => {
    // Implement heart animation/logic
    console.log("Hearted lesson", lessonId);
  };

  useEffect(() => {
    const fetchData = async () => {
      // Guard: Do not attempt to load if role is missing
      if (!profile?.role) {
        setLoading(false);
        return;
      }

      try {
        if (isOnline) {
          // Lessons
          const lessonsSnap = await getDocs(query(collection(db, 'lessons'), limit(5), orderBy('createdAt', 'desc')));
          setLessons(lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)));

          // Dairies (Expired after 24 hours)
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const dairiesQuery = query(
            collection(db, 'dairies'), 
            where('createdAt', '>', oneDayAgo),
            orderBy('createdAt', 'desc')
          );
          const dairiesSnap = await getDocs(dairiesQuery);
          setDairies(dairiesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

          // Assignments
          const assignmentsSnap = await getDocs(query(collection(db, 'assignments'), limit(3), orderBy('deadline', 'asc')));
          setAssignments(assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));

          // Recent Submissions
          const subsQuery = profile.role === 'teacher' 
            ? query(collection(db, 'submissions'), limit(5), orderBy('submittedAt', 'desc'))
            : query(collection(db, 'submissions'), where('studentId', '==', profile.uid), limit(5), orderBy('submittedAt', 'desc'));
          
          const subsSnap = await getDocs(subsQuery);
          setRecentSubmissions(subsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));

          // Reminders (New)
          if (profile.role === 'student' && profile.classIds && profile.classIds.length > 0) {
            const remindersQuery = query(
              collection(db, 'reminders'),
              where('classId', 'in', profile.classIds),
              orderBy('createdAt', 'desc'),
              limit(3)
            );
            const remindersSnap = await getDocs(remindersQuery);
            setReminders(remindersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
          } else if (profile.role === 'teacher') {
            const remindersQuery = query(
              collection(db, 'reminders'),
              where('teacherId', '==', profile.uid),
              orderBy('createdAt', 'desc'),
              limit(3)
            );
            const remindersSnap = await getDocs(remindersQuery);
            setReminders(remindersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
          }
        } else {
          // Offline mode: load from storage
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

    if (profile) fetchData();
  }, [profile, isOnline]);

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

  // Real-time dairies listener (24h filter)
  useEffect(() => {
    if (!isOnline) return;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, 'dairies'),
      where('createdAt', '>', oneDayAgo),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setDairies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [isOnline]);


  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-pulse text-indigo-600 font-medium">Loading your dashboard...</div>
    </div>
  );

  return (
    <div className="flex gap-6 relative">
      {/* Feed Column */}
      <div className="flex-1 max-w-[600px] space-y-4">
        {/* Pull-to-Refresh Visual Cue */}
        <div className="flex justify-center py-2">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full"
          />
        </div>

        {/* Dairies Row */}
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-16 h-16 rounded-full border-2 border-indigo-500 p-0.5 relative">
              <img src={profile?.photoURL || 'https://via.placeholder.com/64'} className="w-full h-full rounded-full object-cover" alt="Me" />
              <div className="absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-1 border-2 border-white">
                <Plus size={10} />
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-900 truncate w-16 text-center">Your Dairy</span>
          </div>
          {dairies.map((dairy) => (
            <div key={dairy.id} className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-16 h-16 rounded-full border-2 border-indigo-500 p-0.5">
                 <img src={dairy.photoURL || 'https://via.placeholder.com/64'} className="w-full h-full rounded-full object-cover" alt="" />
              </div>
              <span className="text-[10px] font-bold text-slate-500 truncate w-16 text-center">{dairy.authorName}</span>
            </div>
          ))}
          {dairies.length === 0 && [1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0 opacity-50">
              <div className="w-16 h-16 rounded-full border-2 border-slate-200 p-0.5">
                <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                  ...
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 truncate w-16 text-center">Classmate</span>
            </div>
          ))}
        </div>

        {/* Composer Placeholder - Teacher Only as requested */}
        {profile?.role === 'teacher' && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <img src={profile?.photoURL || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full" alt="Me" />
              <input 
                type="text"
                value={newDairyText}
                onChange={e => setNewDairyText(e.target.value)}
                placeholder={`What's Latest, ${profile?.displayName?.split(' ')[0]}?`}
                onFocus={() => setShowDiaryComposer(true)}
                className="flex-1 bg-slate-100 h-10 rounded-full flex items-center px-4 text-slate-500 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            
            <AnimatePresence>
              {showDiaryComposer && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                    <button 
                      onClick={() => setShowDiaryComposer(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handlePostDairy}
                      disabled={publishing || !newDairyText.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-md shadow-indigo-100 disabled:opacity-50"
                    >
                      {publishing ? 'Posting...' : 'Post Dairy'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Feed Posts */}
        <div className="space-y-4">
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

          {/* Online Now Box (Mobile only or at the bottom) */}
          <div className="xl:hidden bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Online Now</h3>
              <span className="text-[8px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">{onlineUsers.length} Active</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {onlineUsers.map((u) => (
                <div key={u.uid} className="relative shrink-0 cursor-pointer" onClick={() => setSelectedUser(u)}>
                  <img src={u.photoURL || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded-full border-2 border-white" alt="" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border-2 border-white rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Online Users Sidebar (Right) */}
      <div className="hidden xl:block w-72 h-fit space-y-4 sticky top-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Who's Online</h3>
            <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">{onlineUsers.length} active</span>
          </div>
          
          <div className="space-y-4">
            {onlineUsers.map((u) => (
              <div 
                key={u.uid} 
                onClick={() => setSelectedUser(u)}
                className="flex items-center gap-3 cursor-pointer group hover:bg-slate-50 p-2 rounded-xl transition-all"
              >
                <div className="relative">
                  <img 
                    src={u.photoURL || 'https://via.placeholder.com/40'} 
                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover"
                    alt={u.displayName || ''}
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                    {u.displayName}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter capitalize">
                    {u.role}
                  </p>
                </div>
              </div>
            ))}
            {onlineUsers.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-xs text-slate-400 italic">No one else is online right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* Create Class Button - Teacher Only */}
        {profile?.role === 'teacher' && (
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg p-5 text-white">
            <h3 className="text-sm font-black uppercase tracking-widest mb-2">Teacher Tools</h3>
            <p className="text-[10px] text-indigo-100 mb-4 font-medium">Empower your students by launching a new learning space today.</p>
            <button 
              onClick={() => navigate('/classes')}
              className="w-full py-3 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={14} /> Create a Class
            </button>
          </div>
        )}

        {/* Suggestion / Class Box */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Upcoming Events</h3>
           <div className="space-y-3">
             <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-[9px] font-black text-indigo-600 uppercase mb-1">Tomorrow, 10:00 AM</p>
                <p className="text-xs font-bold text-slate-900">Physics Lab Session</p>
             </div>
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
