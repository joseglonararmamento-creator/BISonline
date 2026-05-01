import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp, onSnapshot, limit, orderBy, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Assignment, Submission, Class, Reminder, UserProfile as UserProfileType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Mail, 
  Hash, 
  Award, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  Camera,
  Save,
  ArrowRight,
  ClipboardList,
  Megaphone,
  Send,
  MessageSquare,
  LayoutGrid,
  Bell,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function Profile() {
  const { profile, isOnline } = useAuth();
  
  // Student specific
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  
  // Teacher specific
  const [classes, setClasses] = useState<Class[]>([]);
  const [studentClasses, setStudentClasses] = useState<Class[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newReminderText, setNewReminderText] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [reminderType, setReminderType] = useState<'status' | 'reminder'>('status');

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [newPhotoURL, setNewPhotoURL] = useState(profile?.photoURL || '');

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !inviteCode.trim() || !isOnline) return;

    setUpdating(true);
    try {
      const q = query(collection(db, 'classes'), where('inviteCode', '==', inviteCode.trim().toUpperCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        alert('Invalid invite code. Please check and try again.');
        return;
      }

      const classId = snap.docs[0].id;

      await updateDoc(doc(db, 'users', profile.uid), {
        classIds: arrayUnion(classId)
      });

      alert(`Successfully joined the class!`);
      setInviteCode('');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to join class.');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      try {
        if (!profile) {
            setLoading(false);
            return;
        }

        if (profile.role === 'student') {
          const assignmentsSnap = await getDocs(collection(db, 'assignments'));
          const allAssignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
          setAssignments(allAssignments);

          const submissionsQuery = query(collection(db, 'submissions'), where('studentId', '==', profile.uid));
          const submissionsSnap = await getDocs(submissionsQuery);
          setSubmissions(submissionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));

          if (profile.classIds && profile.classIds.length > 0) {
            try {
                const classesQuery = query(collection(db, 'classes'), where('__name__', 'in', profile.classIds));
                const cSnap = await getDocs(classesQuery);
                setStudentClasses(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
            } catch (err) {
                console.warn("Could not fetch student classes:", err);
            }
          }
        } else {
          // Teacher data
          const classesQuery = query(collection(db, 'classes'), where('teacherId', '==', profile.uid));
          const snap = await getDocs(classesQuery);
          const teacherClasses = snap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
          setClasses(teacherClasses);
          if (teacherClasses.length > 0) setSelectedClassId(teacherClasses[0].id);

          try {
              const remindersQuery = query(
                collection(db, 'reminders'), 
                where('teacherId', '==', profile.uid),
                orderBy('createdAt', 'desc'),
                limit(10)
              );
              onSnapshot(remindersQuery, (snap) => {
                setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
              }, (err) => {
                  console.error("Reminders listener failed:", err);
              });
          } catch (err) {
              console.error("Failed to setup reminders query:", err);
          }
        }
      } catch (err) {
        console.error("Profile data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  const handlePostReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newReminderText.trim() || !selectedClassId) return;

    try {
      const reminderData = {
        teacherId: profile.uid,
        classId: selectedClassId,
        text: newReminderText,
        type: reminderType,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'reminders'), reminderData);

      // Notify students in that class
      const studentsQuery = query(collection(db, 'users'), where('classId', '==', selectedClassId));
      const studentsSnap = await getDocs(studentsQuery);
      
      const targetClass = classes.find(c => c.id === selectedClassId);
      
      const notificationPromises = studentsSnap.docs.map(async (studentDoc) => {
        await addDoc(collection(db, 'notifications'), {
          userId: studentDoc.id,
          title: reminderType === 'reminder' ? 'New Class Reminder' : 'Teacher Status Update',
          body: `${profile.displayName} posted in ${targetClass?.name || 'Class'}: ${newReminderText.substring(0, 50)}${newReminderText.length > 50 ? '...' : ''}`,
          read: false,
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(notificationPromises);

      setNewReminderText('');
      alert('Post published and students notified!');
    } catch (err) {
      console.error(err);
      alert('Failed to post update.');
    }
  };

  const handleUpdatePhoto = async () => {
    if (!profile || !isOnline) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        photoURL: newPhotoURL
      });
      alert('Profile picture updated successfully!');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to update profile picture.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[500px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  const studentStats = profile?.role === 'student' ? {
    completedCount: submissions.filter(s => s.status === 'graded' || s.status === 'submitted').length,
    progress: assignments.length > 0 ? (submissions.filter(s => s.status === 'graded' || s.status === 'submitted').length / assignments.length) * 100 : 0
  } : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Profile Header */}
      <div className="relative">
        <div className="h-48 bg-gradient-to-r from-indigo-600 to-blue-500 rounded-[40px] shadow-lg overflow-hidden">
          <div className="absolute inset-0 opacity-10 flex flex-wrap gap-4 p-8 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <BookOpen key={i} size={40} />
            ))}
          </div>
        </div>
        
        <div className="absolute -bottom-20 sm:-bottom-16 left-0 right-0 sm:left-8 flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 px-4">
          <div className="relative group shrink-0">
            <img 
              src={profile?.photoURL || 'https://via.placeholder.com/128'} 
              className="w-32 h-32 rounded-[32px] border-8 border-white bg-white shadow-xl object-cover"
              alt="Profile"
            />
            {isOnline && (
              <button 
                onClick={() => {
                  const url = prompt('Enter new Profile Picture URL:', profile?.photoURL || '');
                  if (url) {
                    setNewPhotoURL(url);
                    const fastUpdate = async () => {
                        await updateDoc(doc(db, 'users', profile!.uid), { photoURL: url });
                        window.location.reload();
                    };
                    fastUpdate();
                  }
                }}
                className="absolute inset-0 bg-black/40 rounded-[32px] opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
              >
                <Camera size={32} />
              </button>
            )}
          </div>
          <div className="pb-0 sm:pb-4 text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{profile?.displayName}</h2>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${profile?.role === 'teacher' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {profile?.role}
              </span>
              <span className="text-slate-400 text-xs sm:text-sm flex items-center gap-1">
                <Mail size={14} /> {profile?.email}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-24 sm:pt-20 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Statistics and Info */}
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Account Basics</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
                  <Hash size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Your ID</p>
                  <p className="text-[10px] font-bold text-slate-500 font-mono">{profile?.uid}</p>
                </div>
              </div>
              {profile?.role === 'student' && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
                    <LayoutGrid size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Joined Classes</p>
                    <p className="text-sm font-bold text-slate-700 truncate">
                      {studentClasses.length > 0 ? studentClasses.map(c => c.name).join(', ') : 'No classes joined'}
                    </p>
                  </div>
                </div>
              )}
              {profile?.role === 'teacher' && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
                    <LayoutGrid size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Classes Managed</p>
                    <p className="text-sm font-bold text-slate-700">{classes.length}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {profile?.role === 'student' && (
            <section className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Join New Class</h3>
                <form onSubmit={handleJoinClass} className="space-y-3">
                    <input 
                        type="text" 
                        value={inviteCode}
                        onChange={e => setInviteCode(e.target.value)}
                        placeholder="Enter Invite Code"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono uppercase text-sm"
                    />
                    <button 
                        type="submit"
                        disabled={updating || !inviteCode.trim()}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg"
                    >
                        {updating ? 'Joining...' : 'Link to Class'}
                    </button>
                </form>
            </section>
          )}

          {profile?.role === 'student' && studentStats && (
            <section className="bg-indigo-600 p-8 rounded-[32px] text-white shadow-xl shadow-indigo-100">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <Award size={32} className="text-indigo-200 mb-2" />
                  <h3 className="text-xl font-bold">Academic Progress</h3>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="uppercase tracking-widest text-indigo-200">Assignment Mastery</span>
                    <span>{Math.round(studentStats.progress)}%</span>
                  </div>
                  <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${studentStats.progress}%` }}
                      className="h-full bg-white transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-white/10 p-4 rounded-2xl">
                    <p className="text-[10px] uppercase font-black text-indigo-200 mb-1">Completed</p>
                    <p className="text-2xl font-black">{studentStats.completedCount}</p>
                  </div>
                  <div className="bg-white/10 p-4 rounded-2xl">
                    <p className="text-[10px] uppercase font-black text-indigo-200 mb-1">Total</p>
                    <p className="text-2xl font-black">{assignments.length}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {profile?.role === 'teacher' && (
            <section className="bg-amber-600 p-8 rounded-[32px] text-white shadow-xl shadow-amber-100">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <Users size={32} className="text-amber-200 mb-2" />
                  <h3 className="text-xl font-bold">Class Overview</h3>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-white/10 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase font-black text-amber-200 mb-1">Total Active Classes</p>
                  <p className="text-2xl font-black">{classes.length}</p>
                </div>
                <Link to="/classes" className="w-full py-3 bg-white text-amber-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors shadow-lg">
                  Manage Classes <ArrowRight size={14} />
                </Link>
              </div>
            </section>
          )}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {profile?.role === 'teacher' && (
            <section className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <Megaphone className="text-indigo-600" size={24} />
                    <h3 className="text-xl font-bold text-slate-900">Post Status or Reminder</h3>
                </div>
                
                <form onSubmit={handlePostReminder} className="space-y-4">
                    <div className="flex gap-4 p-1 bg-slate-50 rounded-2xl">
                        <button 
                            type="button"
                            onClick={() => setReminderType('status')}
                            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${reminderType === 'status' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Status Update
                        </button>
                        <button 
                            type="button"
                            onClick={() => setReminderType('reminder')}
                            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${reminderType === 'reminder' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Class Reminder
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Target Class</label>
                            <select 
                                required
                                value={selectedClassId}
                                onChange={e => setSelectedClassId(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 appearance-none"
                            >
                                <option value="" disabled>Choose a class...</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Message Content</label>
                        <textarea 
                            required
                            rows={3}
                            value={newReminderText}
                            onChange={e => setNewReminderText(e.target.value)}
                            placeholder={reminderType === 'status' ? "What's happening in your classes?" : "Don't forget to submit the lab reports!"}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-600 resize-none"
                        />
                    </div>

                    <button 
                        type="submit"
                        disabled={!selectedClassId || !newReminderText.trim()}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:bg-indigo-700 disabled:opacity-50 shadow-xl shadow-indigo-100 transition-all"
                    >
                        <Send size={18} />
                        Publish & Notify Students
                    </button>
                </form>

                <div className="mt-8 pt-8 border-t border-slate-50">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Recent Updates</h4>
                    <div className="space-y-3">
                        {reminders.map(rem => (
                            <div key={rem.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rem.type === 'reminder' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {rem.type === 'reminder' ? <Bell size={18} /> : <MessageSquare size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                            {classes.find(c => c.id === rem.classId)?.name || 'Deleted Class'} • {rem.createdAt ? format(rem.createdAt.toDate(), 'PP p') : 'Just now'}
                                        </p>
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed">{rem.text}</p>
                                </div>
                            </div>
                        ))}
                        {reminders.length === 0 && <p className="text-center py-4 text-slate-400 text-sm font-medium">No updates posted yet.</p>}
                    </div>
                </div>
            </section>
          )}

          {profile?.role === 'student' && (
            <section className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm min-h-[400px]">
                <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                    <ClipboardList className="text-indigo-600" size={24} />
                    Current Assignments
                </h3>
                <Link to="/assignments" className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline">
                    View All
                </Link>
                </div>

                <div className="space-y-4">
                {assignments.length > 0 ? (
                    assignments.slice(0, 5).map(assignment => {
                    const submission = submissions.find(s => s.assignmentId === assignment.id);
                    const isSubmitted = !!submission;
                    const isGraded = submission?.status === 'graded';

                    return (
                        <motion.div 
                        key={assignment.id}
                        whileHover={{ x: 5 }}
                        className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:border-indigo-100 transition-all group"
                        >
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${isSubmitted ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {isSubmitted ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                            </div>
                            <div>
                            <h4 className="font-bold text-slate-900">{assignment.title}</h4>
                            <p className="text-xs text-slate-400 italic">Deadline: {assignment.deadline?.toDate ? format(assignment.deadline.toDate(), 'MMM d, p') : 'TBA'}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {isGraded ? (
                            <div className="text-right">
                                <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Graded</p>
                                <p className="text-lg font-black text-slate-900">{submission.grade}/100</p>
                            </div>
                            ) : isSubmitted ? (
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                Processing
                            </span>
                            ) : (
                            <Link 
                                to="/assignments" 
                                className="p-2 text-slate-300 group-hover:text-amber-500 transition-colors"
                            >
                                <ArrowRight size={20} />
                            </Link>
                            )}
                        </div>
                        </motion.div>
                    );
                    })
                ) : (
                    <div className="py-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-300">
                        <ClipboardList size={32} />
                    </div>
                    <p className="text-slate-400 font-medium">No tasks assigned yet.</p>
                    </div>
                )}
                </div>
                
                {assignments.length > 5 && (
                <div className="mt-8 pt-8 border-t border-slate-50 text-center">
                    <Link to="/assignments" className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200">
                    Explore Tasks
                    </Link>
                </div>
                )}
            </section>
          )}

          {/* Settings Section (Common) */}
          <section className="bg-slate-900 p-8 rounded-[32px] text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Camera size={120} />
            </div>
            <div className="relative z-10 max-w-sm">
                <h3 className="text-xl font-bold mb-2">Display Preferences</h3>
                <p className="text-slate-400 text-sm mb-6">Choose how others see you across the platform.</p>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={newPhotoURL}
                        onChange={e => setNewPhotoURL(e.target.value)}
                        placeholder="Image URL"
                        className="bg-white/10 border-white/20 text-white rounded-xl px-4 py-2 text-sm flex-1 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button 
                        onClick={handleUpdatePhoto}
                        disabled={updating || !isOnline}
                        className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                    >
                        {updating ? <span className="animate-pulse">...</span> : <Save size={18} />}
                    </button>
                </div>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                    {['2', '4', '6', '8', '10'].map(id => (
                        <img 
                            key={id}
                            src={`https://i.pravatar.cc/150?u=${id}`} 
                            draggable={false}
                            className={`w-10 h-10 rounded-lg cursor-pointer border-2 transition-all ${newPhotoURL.includes(`u=${id}`) ? 'border-indigo-500' : 'border-transparent hover:border-white/50'}`}
                            onClick={() => setNewPhotoURL(`https://i.pravatar.cc/150?u=${id}`)}
                        />
                    ))}
                </div>
                {!isOnline && <p className="text-[10px] text-amber-500 font-bold mt-2 uppercase tracking-widest">Connect to change photo</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
