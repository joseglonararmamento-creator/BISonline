import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Lesson, Assignment, Submission, Reminder } from '../types';
import { motion } from 'motion/react';
import localforage from 'localforage';
import { BookOpen, ClipboardList, CheckCircle2, Clock, ArrowRight, TrendingUp, AlertCircle, MessageSquare, CloudOff, Share2, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import ShareModal from '../components/ShareModal';

export default function Dashboard() {
  const { profile, isOnline } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

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


  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-pulse text-indigo-600 font-medium">Loading your dashboard...</div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            Hello, {profile?.displayName?.split(' ')[0]}! 👋
          </h2>
          <p className="text-slate-500 mt-1">
            {isOnline 
              ? "Here's what's happening in your classes today." 
              : "You're in offline mode. Accessing downloaded modules."}
          </p>
        </div>
        <div className="flex gap-2">
          {isOnline && profile?.role === 'teacher' && (
            <>
              <button 
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs ring-1 ring-indigo-200 hover:bg-indigo-100 transition-all"
              >
                <Share2 size={16} /> Share App
              </button>
              <Link
                to="/insights"
                className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all shadow-sm"
              >
                <TrendingUp size={16} /> View Insights
              </Link>
            </>
          )}
          {isOnline ? (
            <Link 
              to="/calendar" 
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              View Calendar
            </Link>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl font-bold text-xs ring-1 ring-amber-200">
              <CloudOff size={14} /> Offline Access Active
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<BookOpen className="text-blue-600" />} 
          label={isOnline ? "Total Lessons" : "Offline Lessons"} 
          value={isOnline ? lessons.length.toString() : offlineCount.toString()} 
          color="bg-blue-50"
        />
        <StatCard 
          icon={<ClipboardList className="text-purple-600" />} 
          label="Pending Assignments" 
          value={isOnline ? assignments.filter(a => new Date(a.deadline.toDate()) > new Date()).length.toString() : "Online Only"} 
          color="bg-purple-50"
        />
        <StatCard 
          icon={<CheckCircle2 className="text-emerald-600" />} 
          label="Assignments Done" 
          value={isOnline ? recentSubmissions.filter(s => s.status === 'graded' || s.status === 'submitted').length.toString() : "Online Only"} 
          color="bg-emerald-50"
        />
        <StatCard 
          icon={<TrendingUp className="text-amber-600" />} 
          label="Growth Score" 
          value={isOnline && recentSubmissions.length > 0 ? "3.8/4.0" : "---"} 
          color="bg-amber-50"
        />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Student Progress Chart Placeholder */}
        {profile?.role === 'student' && (
          <section className="lg:col-span-3">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="text-indigo-600" size={20} />
              Growth Tracking
            </h3>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-8 items-center">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path className="text-slate-100" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path className="text-indigo-600" strokeDasharray="85, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-slate-900">85%</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</span>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <h4 className="text-xl font-bold text-slate-900">Keep it up, {profile.displayName}!</h4>
                <p className="text-slate-500 text-sm max-w-md">You've completed 85% of your course objectives this semester. Your scores in Quizzes and Assignments are consistently above average. Finish the remaining 3 modules to earn your certificate.</p>
                <div className="flex gap-3">
                  <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-xs font-bold ring-2 ring-indigo-5/10">8/10 Quizzes</div>
                  <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-bold ring-2 ring-emerald-5/10">12/15 Tasks</div>
                </div>
              </div>
            </div>
          </section>
        )}
        {/* Recent Lessons */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-900">Recent Lessons</h3>
              <Link to="/lessons" className="text-sm font-medium text-indigo-600 hover:underline flex items-center gap-1">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lessons.map((lesson) => (
                <Link key={lesson.id} to={`/lessons`} className="block">
                  <motion.div 
                    whileHover={{ y: -4 }}
                    className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-4">
                      <BookOpen className="text-indigo-600" size={20} />
                    </div>
                    <h4 className="font-bold text-slate-900 mb-2">{lesson.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{lesson.content}</p>
                  </motion.div>
                </Link>
              ))}
              {lessons.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                  No lessons found.
                </div>
              )}
            </div>
          </section>

          {/* Activity Feed */}
          <section>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Activity Feed</h3>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-sm">
              <div className="divide-y divide-slate-100">
                {recentSubmissions.map((sub) => (
                  <div key={sub.id} className="p-4 flex items-start gap-4">
                    <div className={`p-2 rounded-full ${sub.status === 'graded' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {sub.status === 'graded' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                    </div>
                    <div>
                      <p className="text-slate-900 font-medium">
                        {profile?.role === 'teacher' ? `New submission received` : `Submission ${sub.status}`}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {format(sub.submittedAt.toDate(), 'EEE, MMM d, h:mm a')}
                      </p>
                    </div>
                    {sub.grade !== undefined && (
                      <div className="ml-auto font-bold text-indigo-600">
                        {sub.grade}/100
                      </div>
                    )}
                  </div>
                ))}
                {recentSubmissions.length === 0 && (
                  <div className="p-8 text-center text-slate-400 italic">
                    No recent activity yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-8">
          {/* Upcoming Assignments */}
          <section>
            <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-red-500" />
              Deadlines
            </h3>
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="font-bold text-slate-900 text-sm mb-1">{assignment.title}</h4>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-500 font-medium">
                      Due {format(assignment.deadline.toDate(), 'MMM d')}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">
                      {format(assignment.deadline.toDate(), 'h:mm a')}
                    </span>
                  </div>
                </div>
              ))}
              {assignments.length === 0 && (
                <div className="py-8 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                  All caught up!
                </div>
              )}
            </div>
          </section>

          {/* Quick Chat */}
          <section className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200">
            <h3 className="text-lg font-bold mb-2">Need help?</h3>
            <p className="text-indigo-100 text-sm mb-4">Start a conversation with your teacher or students instantly.</p>
            <Link 
              to="/chat" 
              className="inline-flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Open Messenger
              <MessageSquare size={16} />
            </Link>
          </section>

          {/* Teacher Updates */}
          <section>
            <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Megaphone size={20} className="text-indigo-600" />
              Teacher Updates
            </h3>
            <div className="space-y-3">
              {reminders.map((rem) => (
                <div key={rem.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${rem.type === 'reminder' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {rem.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {rem.createdAt ? format(rem.createdAt.toDate(), 'MMM d, p') : 'Just now'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{rem.text}</p>
                </div>
              ))}
              {reminders.length === 0 && (
                <div className="py-8 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                  No recent updates.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
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
