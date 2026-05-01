export type UserRole = 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  classNumber?: string; // Legacy
  classId?: string; // Legacy (single class)
  classIds?: string[]; // New: Multiple classes
  isOnline?: boolean;
  lastActive?: any;
  subjectHandled?: string;
  yearsOfTeaching?: string;
  gender?: string;
  bio?: string;
  createdAt: any;
}

export interface Class {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  inviteCode: string;
  createdAt: any;
}

export interface Reminder {
  id: string;
  teacherId: string;
  classId: string;
  text: string;
  type: 'status' | 'reminder';
  createdAt: any;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  mediaUrls: string[];
  fileUrl?: string;
  fileName?: string;
  teacherId: string;
  createdAt: any;
}

export interface Assignment {
  id: string;
  lessonId: string;
  title: string;
  description: string;
  deadline: any;
  teacherId: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  grade?: number;
  feedback?: string;
  status: 'submitted' | 'graded';
  submittedAt: any;
}

export interface Quiz {
  id: string;
  lessonId: string;
  title: string;
  questions: QuizQuestion[];
  teacherId: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  score: number;
  total: number;
  completedAt: any;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string; // Optional for group/class chats
  classId?: string; // New: Link to a specific Class
  classNumber?: string; // Legacy: For class-based chats
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'emoji';
  createdAt: any;
  reactions?: Record<string, string[]>; // emoji -> list of userIds
  readBy?: string[]; // list of userIds
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: any;
  type: string;
}
