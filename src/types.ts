// Core domain types matching the Blackboard Learn REST API v3 shapes

export interface BbCourse {
  id: string;
  courseId: string;
  name: string;
  description?: string;
  instructor?: string;
  term?: string;
  availability?: { available: string };
  enrollment?: { type: string };
}

export interface BbAssignment {
  id: string;
  title: string;
  instructions?: string;
  due?: string; // ISO 8601
  maxAttempts?: number;
  maxScore?: number;
  gradeColumnId?: string;
  status?: string;
  columnId?: string;
  name?: string;
  description?: string;
  weight?: number;
  gradingType?: string;
}

export interface BbGrade {
  userId: string;
  columnId: string;
  status?: string;
  score?: number;
  text?: string;
  feedback?: string;
  instructor_notes?: string;
  attempt?: {
    id?: string;
    created?: string;
    modified?: string;
    studentComments?: string;
    feedback?: string;
  };
}

export interface BbAnnouncement {
  id: string;
  title: string;
  body: string;
  created?: string;
  modified?: string;
  creator?: { id: string; userName?: string };
  availability?: { duration?: { type?: string; start?: string; end?: string } };
}

export interface BbContent {
  id: string;
  title: string;
  body?: string;
  contentHandler?: { id: string };
  availability?: { available: string };
}

export interface BbUser {
  id: string;
  userId?: string;
  userName: string;
  name?: { given?: string; family?: string };
  emailAddress?: string;
  role?: string;
}

export interface BbDiscussionPost {
  id: string;
  authorId?: string;
  body?: string;
  created?: string;
  position?: number;
  children?: BbDiscussionPost[];
}

export interface BbAttempt {
  id: string;
  userId: string;
  status?: string;
  created?: string;
  modified?: string;
  submittedDate?: string;
  studentComments?: string;
  feedback?: string;
  instructorNotes?: string;
  score?: number;
}

export interface TokenCache {
  accessToken: string;
  expiresAt: number; // unix ms
}
