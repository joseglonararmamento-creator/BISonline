import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, deleteDoc, doc, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Class, UserProfile } from '../types';
import { 
  Plus, 
  Users, 
  Trash2, 
  Copy, 
  CheckCircle2, 
  Search,
  BookOpen,
  LayoutGrid,
  X,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function TeacherClasses() {
  const { profile, isOnline } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    if (!profile || profile.role !== 'teacher') return;

    const q = query(
      collection(db, 'classes'),
      where('teacherId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClasses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    });

    const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      setAllStudents(snapshot.docs.map(d => d.data() as UserProfile));
    });

    return () => {
      unsubscribe();
      unsubscribeStudents();
    };
  }, [profile]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newClassName.trim()) return;

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      await addDoc(collection(db, 'classes'), {
        name: newClassName,
        description: newClassDescription,
        teacherId: profile.uid,
        inviteCode,
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewClassName('');
      setNewClassDescription('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this class? All student links will be broken.')) return;
    try {
      await deleteDoc(doc(db, 'classes', id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMember = async (student: UserProfile, isAdding: boolean) => {
    if (!selectedClass || !isOnline) return;
    try {
      if (isAdding) {
        await updateDoc(doc(db, 'users', student.uid), {
          classIds: arrayUnion(selectedClass.id)
        });
      } else {
        await updateDoc(doc(db, 'users', student.uid), {
          classIds: arrayRemove(selectedClass.id)
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStudentCount = (classId: string) => {
    return allStudents.filter(s => s.classIds?.includes(classId)).length;
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Class Management</h2>
          <p className="text-slate-500">Create and oversee your learning environments.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all"
        >
          <Plus size={20} />
          Create New Class
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {classes.map((cls) => {
            const count = getStudentCount(cls.id);
            return (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow group flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <LayoutGrid size={24} />
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => { setSelectedClass(cls); setShowMembersModal(true); }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title="Manage Students"
                    >
                      <Users size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteClass(cls.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-1">{cls.name}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-6 flex-1">{cls.description || 'No description provided.'}</p>

                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invite Code</p>
                      <p className="font-mono font-bold text-indigo-600 tracking-wider">{cls.inviteCode}</p>
                    </div>
                    <button 
                      onClick={() => copyInviteCode(cls.inviteCode)}
                      className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"
                    >
                      {copiedId === cls.inviteCode ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Users size={14} />
                      <span>{count} Students</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BookOpen size={14} />
                      <span>0 Lessons</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {classes.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-[40px] border-2 border-dashed border-slate-200">
            <LayoutGrid size={48} className="mb-4 opacity-20" />
            <p className="font-bold">No classes created yet</p>
            <p className="text-sm">Click the button above to start your first class</p>
          </div>
        )}
      </div>

      {/* Class Create Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-[40px] p-8 md:p-10 w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <h2 className="text-3xl font-black text-slate-900 mb-2">New Learning Space</h2>
              <p className="text-slate-500 mb-8">Define your classroom and invite students.</p>

              <form onSubmit={handleCreateClass} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Class Name</label>
                  <input 
                    type="text" 
                    required
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g. Advanced Mathematics"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Description</label>
                  <textarea 
                    rows={3}
                    value={newClassDescription}
                    onChange={(e) => setNewClassDescription(e.target.value)}
                    placeholder="What will students learn here?"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-medium text-slate-600 resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 text-slate-500 font-black text-sm uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-indigo-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all"
                  >
                    Launch Class
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Members Management Modal */}
      <AnimatePresence>
        {showMembersModal && selectedClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMembersModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="relative bg-white h-full max-h-[90vh] md:w-full md:max-w-2xl shadow-2xl rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{selectedClass.name}</h3>
                  <p className="text-sm text-slate-500 font-medium">Manage members and link students</p>
                </div>
                <button 
                  onClick={() => setShowMembersModal(false)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 bg-slate-50">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    placeholder="Search students by name..."
                    className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-slate-700 text-sm shadow-sm"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {allStudents
                  .filter(s => s.displayName?.toLowerCase().includes(studentSearch.toLowerCase()))
                  .map(student => {
                    const isMember = student.classIds?.includes(selectedClass.id);
                    return (
                      <div key={student.uid} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:shadow-sm transition-all group">
                        <div className="flex items-center gap-4">
                          <img 
                            src={student.photoURL || `https://ui-avatars.com/api/?name=${student.displayName}`} 
                            className="w-10 h-10 rounded-xl shadow-sm"
                            alt=""
                          />
                          <div>
                            <p className="font-bold text-slate-900">{student.displayName}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{student.email}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleToggleMember(student, !isMember)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                            isMember 
                            ? 'bg-red-50 text-red-500 hover:bg-red-100' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                          }`}
                        >
                          {isMember ? (
                            <><UserMinus size={14} /> Remove</>
                          ) : (
                            <><UserPlus size={14} /> Tag to Class</>
                          )}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
