import { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc, 
  deleteDoc,
  limit,
  getDocs
} from 'firebase/firestore';
import { db, storage, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  Loader2, 
  X, 
  Smile, 
  Plus,
  Users,
  Search,
  Book,
  GraduationCap,
  MessageCircle,
  FileText,
  Download,
  Youtube,
  ExternalLink,
  Phone,
  Video,
  Mic,
  ChevronRight,
  MoreVertical,
  Trash2,
  Undo2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { uploadWithProgress } from '../services/storageService';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  mediaUrl?: string;
  mediaType?: 'image' | 'file' | 'audio';
  fileName?: string;
  fileSize?: number;
  youtubeMetadata?: {
    videoId: string;
    title: string;
  };
  reactions?: { [emoji: string]: string[] };
}

interface ChatUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  role: string;
  isOnline?: boolean;
}

const AudioPlayer = ({ src, isMine }: { src: string, isMine: boolean }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  return (
    <div className={`flex items-center gap-2 p-2 rounded-xl border ${isMine ? 'bg-indigo-700/50 border-white/20' : 'bg-slate-50 border-slate-200'}`}>
      <button 
        onClick={() => {
          if (playing) audioRef.current?.pause();
          else audioRef.current?.play();
          setPlaying(!playing);
        }}
        className={`w-8 h-8 rounded-full flex items-center justify-center ${isMine ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}
      >
        {playing ? <div className="w-1.5 h-1.5 bg-current rounded-full animate-ping" /> : <Mic size={14} />}
      </button>
      <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
        <audio 
          ref={audioRef} 
          src={src} 
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
        {playing && <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 5 }} className="h-full bg-indigo-500" />}
      </div>
    </div>
  );
};

export default function Chat() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [chatType, setChatType] = useState<'class' | 'dm'>('dm');
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [userClasses, setUserClasses] = useState<any[]>([]);
  const [uploadingProgress, setUploadingProgress] = useState<number | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [showUndo, setShowUndo] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => d.data() as ChatUser).filter(u => u.uid !== profile.uid));
    });
    return () => unsubscribe();
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'classes'), where('students', 'array-contains', profile.uid));
    const teacherQ = query(collection(db, 'classes'), where('teacherId', '==', profile.uid));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUserClasses(prev => [...prev, ...classes]);
    });
    const unsubscribeTeacher = onSnapshot(teacherQ, (snap) => {
      const classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUserClasses(prev => [...prev, ...classes]);
    });
    
    return () => {
      unsubscribe();
      unsubscribeTeacher();
    };
  }, [profile?.uid]);

  useEffect(() => {
    let q;
    if (chatType === 'dm' && selectedUser && profile) {
      const chatId = profile.uid < selectedUser.uid ? `${profile.uid}_${selectedUser.uid}` : `${selectedUser.uid}_${profile.uid}`;
      q = query(collection(db, `chats/${chatId}/messages`), orderBy('createdAt', 'asc'));
    } else if (chatType === 'class' && selectedClass) {
      q = query(collection(db, `classes/${selectedClass.id}/messages`), orderBy('createdAt', 'asc'));
    }

    if (!q) {
      setMessages([]);
      return;
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (err) => {
      console.error("Chat sync error:", err);
      window.alert("Failed to sync chat messages. Please check your connection.");
    });

    return () => unsubscribe();
  }, [chatType, selectedUser, selectedClass, profile?.uid]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !uploadingProgress) || !profile) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    let chatId = '';
    if (chatType === 'dm' && selectedUser) {
      chatId = profile.uid < selectedUser.uid ? `${profile.uid}_${selectedUser.uid}` : `${selectedUser.uid}_${profile.uid}`;
    } else if (chatType === 'class' && selectedClass) {
      chatId = selectedClass.id;
    }

    try {
      const payload: any = {
        senderId: profile.uid,
        text: messageText,
        createdAt: serverTimestamp(),
        reactions: {}
      };

      // YouTube Integration
      const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([^&?\s]+)/;
      const match = messageText.match(youtubeRegex);
      if (match && match[1]) {
        payload.youtubeMetadata = { videoId: match[1], title: 'Loading...' };
      }

      const colPath = chatType === 'dm' ? `chats/${chatId}/messages` : `classes/${chatId}/messages`;
      const docRef = await addDoc(collection(db, colPath), payload);
      
      // Update undo state
      setShowUndo(docRef.id);
      setTimeout(() => setShowUndo(null), 5000);
      
    } catch (err: any) {
      console.error("Send error:", err);
      window.alert("Failed to send message: " + err.message);
    }
  };

  const handleUndo = async () => {
    if (!showUndo || !profile) return;
    let chatId = '';
    if (chatType === 'dm' && selectedUser) {
      chatId = profile.uid < selectedUser.uid ? `${profile.uid}_${selectedUser.uid}` : `${selectedUser.uid}_${profile.uid}`;
    } else if (chatType === 'class' && selectedClass) {
      chatId = selectedClass.id;
    }
    const colPath = chatType === 'dm' ? `chats/${chatId}/messages` : `classes/${chatId}/messages`;
    
    try {
      await deleteDoc(doc(db, colPath, showUndo));
      setShowUndo(null);
    } catch (err: any) {
      alert("Undo failed: " + err.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    let chatId = '';
    if (chatType === 'dm' && selectedUser) {
      chatId = profile.uid < selectedUser.uid ? `${profile.uid}_${selectedUser.uid}` : `${selectedUser.uid}_${profile.uid}`;
    } else if (chatType === 'class' && selectedClass) {
      chatId = selectedClass.id;
    }

    try {
       const url = await uploadWithProgress(file, `chat/${chatId}`, (p) => setUploadingProgress(p));
       const colPath = chatType === 'dm' ? `chats/${chatId}/messages` : `classes/${chatId}/messages`;
       
       await addDoc(collection(db, colPath), {
         senderId: profile.uid,
         mediaUrl: url,
         mediaType: 'image',
         text: '',
         createdAt: serverTimestamp(),
         reactions: {}
       });
    } catch (err: any) {
      window.alert("Upload failed: " + err.message);
    } finally {
      setUploadingProgress(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    let chatId = '';
    if (chatType === 'dm' && selectedUser) {
      chatId = profile.uid < selectedUser.uid ? `${profile.uid}_${selectedUser.uid}` : `${selectedUser.uid}_${profile.uid}`;
    } else if (chatType === 'class' && selectedClass) {
      chatId = selectedClass.id;
    }

    try {
       const url = await uploadWithProgress(file, `chat/${chatId}`, (p) => setUploadingProgress(p));
       const colPath = chatType === 'dm' ? `chats/${chatId}/messages` : `classes/${chatId}/messages`;
       
       await addDoc(collection(db, colPath), {
         senderId: profile.uid,
         mediaUrl: url,
         mediaType: 'file',
         fileName: file.name,
         fileSize: file.size,
         text: '',
         createdAt: serverTimestamp(),
         reactions: {}
       });
    } catch (err: any) {
      window.alert("File upload failed: " + err.message);
    } finally {
      setUploadingProgress(null);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], "voice_message.webm", { type: 'audio/webm' });
        
        let chatId = '';
        if (chatType === 'dm' && selectedUser) {
          chatId = profile?.uid! < selectedUser.uid ? `${profile?.uid}_${selectedUser.uid}` : `${selectedUser.uid}_${profile?.uid}`;
        } else if (chatType === 'class' && selectedClass) {
          chatId = selectedClass.id;
        }

        try {
          const url = await uploadWithProgress(audioFile, `chat/${chatId}`, (p) => setUploadingProgress(p));
          const colPath = chatType === 'dm' ? `chats/${chatId}/messages` : `classes/${chatId}/messages`;
          await addDoc(collection(db, colPath), {
            senderId: profile?.uid,
            mediaUrl: url,
            mediaType: 'audio',
            text: '',
            createdAt: serverTimestamp(),
            reactions: {}
          });
        } catch (err: any) {
          alert("Audio upload failed: " + err.message);
        } finally {
          setUploadingProgress(null);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!profile) return;
    let chatId = '';
    if (chatType === 'dm' && selectedUser) {
      chatId = profile.uid < selectedUser.uid ? `${profile.uid}_${selectedUser.uid}` : `${selectedUser.uid}_${profile.uid}`;
    } else if (chatType === 'class' && selectedClass) {
      chatId = selectedClass.id;
    }
    const colPath = chatType === 'dm' ? `chats/${chatId}/messages` : `classes/${chatId}/messages`;
    
    const msg = messages?.find(m => m.id === messageId);
    if (!msg) return;

    const reactions = msg.reactions || {};
    const usersWhoReacted = reactions[emoji] || [];
    
    if (usersWhoReacted.includes(profile.uid)) {
      reactions[emoji] = usersWhoReacted.filter(id => id !== profile.uid);
    } else {
      reactions[emoji] = [...usersWhoReacted, profile.uid];
    }

    try {
      await updateDoc(doc(db, colPath, messageId), { reactions });
      setShowReactionPicker(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  try {
    if (!messages) return (
      <div className="flex h-full items-center justify-center bg-white/50 backdrop-blur-md">
        <div className="p-8 bg-white border border-slate-200 rounded-3xl shadow-xl flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Loading messages...</p>
        </div>
      </div>
    );

    return (
      <div className="h-full flex overflow-hidden bg-[#F8FAFC]">
      {/* Search & List Sidebar */}
      <div className="w-80 border-r border-slate-200 hidden md:flex flex-col bg-white">
        <div className="p-6">
          <h2 className="text-xl font-black text-slate-900 mb-4 tracking-tight">Messenger</h2>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Contacts, classes..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button 
              onClick={() => setChatType('dm')}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chatType === 'dm' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
            >
              Members
            </button>
            <button 
              onClick={() => setChatType('class')}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chatType === 'class' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
            >
              Classes
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-2">
          {chatType === 'dm' ? (
            users.map(u => (
              <button 
                key={u.uid}
                onClick={() => setSelectedUser(u)}
                className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${selectedUser?.uid === u.uid ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50'}`}
              >
                <div className="relative">
                  <img src={u.photoURL || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="" />
                  {u.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{u.displayName}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{u.role}</p>
                </div>
              </button>
            ))
          ) : (
            userClasses.map(c => (
              <button 
                key={c.id}
                onClick={() => setSelectedClass(c)}
                className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-all ${selectedClass?.id === c.id ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50'}`}
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                  <Book size={20} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold truncate">{c.name}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{c.teacherName}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-white md:bg-transparent">
        {selectedUser || selectedClass ? (
          <>
            {/* Header */}
            <div className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <button className="md:hidden p-2 -ml-2 text-slate-400" onClick={() => { setSelectedUser(null); setSelectedClass(null); }}>
                  <ChevronRight size={24} className="rotate-180" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {chatType === 'dm' ? (
                      <img src={selectedUser?.photoURL || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full border-2 border-indigo-50" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                        <GraduationCap size={20} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{chatType === 'dm' ? selectedUser?.displayName : selectedClass?.name}</h3>
                    <div className="flex items-center gap-2">
                       <span className={`w-1.5 h-1.5 rounded-full ${selectedUser?.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                         {chatType === 'dm' ? (selectedUser?.isOnline ? 'Active' : 'Offline') : `${selectedClass?.students?.length || 0} Members`}
                       </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2.5 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"><Phone size={18} /></button>
                <button className="p-2.5 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"><Video size={18} /></button>
                <button className="p-2.5 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"><MoreVertical size={18} /></button>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
              {(messages || []).map((m, index) => {
                const isMine = m?.senderId === profile?.uid;
                const sender = users?.find(u => u?.uid === m?.senderId);
                const prevMsg = index > 0 ? (messages || [])[index - 1] : null;
                const showDate = index === 0 || 
                  (m?.createdAt && prevMsg?.createdAt && 
                  format(m.createdAt.toDate(), 'yyyy-MM-dd') !== format(prevMsg.createdAt.toDate(), 'yyyy-MM-dd'));

                return (
                  <div key={m?.id}>
                    {showDate && (
                      <div className="flex justify-center my-8">
                        <span className="px-4 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm">
                          {m?.createdAt ? format(m.createdAt.toDate(), 'MMMM d, yyyy') : 'Recently'}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col relative`}>
                        {!isMine && chatType === 'class' && (
                          <span className="text-[10px] font-bold text-slate-500 ml-2 mb-1 flex items-center gap-1">
                             {sender?.displayName || 'Member'}
                          </span>
                        )}
                        
                        <div className="group relative">
                          <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                            isMine 
                              ? 'bg-indigo-600 text-white rounded-br-none' 
                              : 'bg-white border border-slate-100 text-slate-800 rounded-bl-none'
                          }`}>
                            {m?.mediaType === 'image' && (
                              <img src={m?.mediaUrl} className="rounded-lg mb-2 max-w-full" alt="" />
                            )}
                            {m?.mediaType === 'file' && (
                               <div className="p-3 bg-white/10 rounded-xl flex items-center gap-3 mb-2 border border-white/10">
                                 <FileText size={20} />
                                 <div className="flex-1 min-w-0">
                                   <p className="text-xs font-bold truncate">{m?.fileName}</p>
                                   <p className="text-[9px] uppercase tracking-widest opacity-60">Attachment</p>
                                 </div>
                                 <a href={m?.mediaUrl} target="_blank" rel="noreferrer" className="p-2 hover:bg-white/20 rounded-lg"><Download size={14} /></a>
                               </div>
                            )}
                            {m?.mediaType === 'audio' && (
                               <AudioPlayer src={m?.mediaUrl || ''} isMine={isMine} />
                            )}
                            {m?.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{m?.text}</p>}

                            {/* Reactions */}
                            {m?.reactions && Object.keys(m.reactions).length > 0 && (
                              <div className={`absolute -bottom-3 ${isMine ? 'right-0' : 'left-0'} flex flex-wrap gap-1`}>
                                {Object.entries(m.reactions).map(([emoji, uids]) => (
                                  uids && uids.length > 0 && (
                                    <div key={emoji} className="px-1.5 py-0.5 bg-white border border-slate-100 rounded-full shadow-sm text-[10px] flex items-center gap-1">
                                      <span>{emoji}</span>
                                      <span className="font-bold text-slate-400">{uids.length}</span>
                                    </div>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className={`mt-1 flex items-center gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                               {m?.createdAt ? format(m.createdAt.toDate(), 'h:mm a') : 'Sending...'}
                             </span>
                             <button 
                               onClick={() => setShowReactionPicker(showReactionPicker === m?.id ? null : m?.id)}
                               className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600"
                             >
                               <Smile size={10} />
                             </button>
                          </div>

                          <AnimatePresence>
                            {showReactionPicker === m?.id && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={`absolute bottom-full mb-2 ${isMine ? 'right-0' : 'left-0'} p-2 bg-white rounded-full shadow-2xl border border-slate-100 z-20 flex gap-2`}
                              >
                                {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                                  <button 
                                    key={emoji} 
                                    onClick={() => handleAddReaction(m?.id, emoji)}
                                    className="hover:scale-125 transition-transform p-1"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-slate-100 relative">
              <AnimatePresence>
                {showUndo && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-full left-6 mb-4 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-4 z-50"
                  >
                    <span className="text-[10px] font-bold">Message Sent</span>
                    <button onClick={handleUndo} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:underline">Undo</button>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {uploadingProgress !== null && (
                <div className="mb-4">
                   <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                     <motion.div className="h-full bg-indigo-600" animate={{ width: `${uploadingProgress}%` }} />
                   </div>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-2 items-center bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-indigo-600 transition-colors">
                  <ImageIcon size={20} />
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                </button>
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent px-2 outline-none text-sm font-medium"
                />
                <button 
                  type="button" 
                  onMouseDown={startRecording} 
                  onMouseUp={stopRecording} 
                  className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400'}`}
                >
                  <Mic size={20} />
                </button>
                <button type="submit" disabled={!newMessage.trim()} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg disabled:opacity-30">
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/10">
            <div className="w-24 h-24 bg-white rounded-[32px] shadow-sm flex items-center justify-center mb-6">
              <Users size={40} className="text-indigo-100" />
            </div>
            <h4 className="text-xl font-black text-slate-900 mb-2">Campus Connect</h4>
            <p className="text-sm max-w-xs text-center leading-relaxed">Choose a contact or classroom to start collaborating with your academic community.</p>
          </div>
        )}
      </div>
    </div>
  );
  } catch (renderError) {
    return <div style={{padding: '40px', textAlign: 'center'}} className="font-bold text-slate-900">Chat Render Error - Please Refresh App</div>;
  }
}
