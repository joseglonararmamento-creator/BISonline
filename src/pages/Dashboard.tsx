import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Lesson, Assignment, Submission, Reminder, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { BookOpen, ClipboardList, CheckCircle2, Clock, ArrowRight, TrendingUp, AlertCircle, MessageSquare, CloudOff, Share2, Megaphone, LayoutDashboard, User, MessageCircle, ExternalLink, X } from 'lucide-react';
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isOnline) {
          // Lessons
          const lessonsSnap = await getDocs(query(collection(db, 'lessons'), limit(3), orderBy('createdAt', 'desc')));
          setLessons(lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)));

          // Assignments
          const assignmentsSnap = await getDocs(query(collection(db, 'assignments'), limit(3), orderBy('deadline', 'asc')));
          setAssignments(assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));

          // Recent Submissions
          const subsQuery = profile?.role === 'teacher' 
            ? query(collection(db, 'submissions'), limit(5), orderBy('submittedAt', 'desc'))
            : query(collection(db, 'submissions'), where('studentId', '==', profile?.uid), limit(5), orderBy('submittedAt', 'desc'));
          
          const subsSnap = await getDocs(subsQuery);
          setRecentSubmissions(subsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));

          // Reminders (New)
          if (profile?.role === 'student' && profile.classIds && profile.classIds.length > 0) {
            const remindersQuery = query(
              collection(db, 'reminders'),
              where('classId', 'in', profile.classIds),
              orderBy('createdAt', 'desc'),
              limit(3)
            );
            const remindersSnap = await getDocs(remindersQuery);
            setReminders(remindersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
          } else if (profile?.role === 'teacher') {
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

        {/* Stories Row */}
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-16 h-16 rounded-full border-2 border-indigo-500 p-0.5">
              <img src={profile?.photoURL || 'https://via.placeholder.com/64'} className="w-full h-full rounded-full object-cover" alt="Me" />
            </div>
            <span className="text-[10px] font-bold text-slate-900 truncate w-16 text-center">My Story</span>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-16 h-16 rounded-full border-2 border-slate-200 p-0.5">
                <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                  Class
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 truncate w-16 text-center">Update {i}</span>
            </div>
          ))}
        </div>

        {/* Composer Placeholder */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <img src={profile?.photoURL || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full" alt="Me" />
          <div className="flex-1 bg-slate-100 h-10 rounded-full flex items-center px-4 text-slate-500 text-sm cursor-pointer hover:bg-slate-200 transition-colors">
            What's on your mind, {profile?.displayName?.split(' ')[0]}?
          </div>
        </div>

        {/* Feed Posts */}
        <div className="space-y-4">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">B</div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">BISonline Academic</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Post • {lesson.createdAt ? format(lesson.createdAt.toDate(), 'MMM d') : 'Recently'}</p>
                  </div>
                </div>
              </div>
              <div className="px-4 pb-3">
                <h5 className="font-bold text-slate-900 mb-1">{lesson.title}</h5>
                <p className="text-sm text-slate-600 line-clamp-3">{lesson.content}</p>
              </div>
              <div className="aspect-video bg-slate-100 flex items-center justify-center">
                <BookOpen size={48} className="text-slate-300" />
              </div>
              <div className="p-2 flex items-center gap-4 border-t border-slate-50">
                <button className="flex-1 py-1.5 hover:bg-slate-50 rounded-lg text-slate-500 font-bold text-xs">Learn</button>
                <button className="flex-1 py-1.5 hover:bg-slate-50 rounded-lg text-slate-500 font-bold text-xs">Share</button>
              </div>
            </div>
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
