import { initializeApp } from "firebase/app"
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from "firebase/auth"
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "firebase/firestore"

// ── Config ──
const firebaseConfig = {
  apiKey: "AIzaSyA00evIVEQJDpC0CniBqn7mjpW5Nk1FeGI",
  authDomain: "ojtattendance-8386d.firebaseapp.com",
  projectId: "ojtattendance-8386d",
  storageBucket: "ojtattendance-8386d.firebasestorage.app",
  messagingSenderId: "1094143406412",
  appId: "1:1094143406412:web:3c29dc773ffbbb45a4dfe9",
  measurementId: "G-3Z4TQNLLQL"
}

// ── Initialize ──
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)

// ────────────────────────────────────────────
// AUTH
// ────────────────────────────────────────────

// Login — returns user + their role from Firestore
export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  const userDoc    = await getDoc(doc(db, "users", credential.user.uid))
  if (!userDoc.exists()) throw new Error("User record not found.")
  return { uid: credential.user.uid, ...userDoc.data() }
}

// Logout
export async function logoutUser() {
  await signOut(auth)
}

// ────────────────────────────────────────────
// USERS (Firestore: "users" collection)
// ────────────────────────────────────────────
// Each user doc looks like:
// {
//   name: "Maria Santos",
//   email: "maria@intern.com",
//   role: "student" | "admin",
//   hoursRendered: 0,
//   hoursRequired: 600,
//   createdAt: timestamp
// }

// Get a single user
export async function getUser(uid) {
  const snap = await getDoc(doc(db, "users", uid))
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null
}

// Get all interns (role === "student")
export async function getAllInterns() {
  const q    = query(collection(db, "users"), where("role", "==", "student"))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
}

// Add new intern (creates Firebase Auth account + Firestore doc)
export async function addIntern(email, password, name, hoursRequired = 600) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, "users", credential.user.uid), {
    name,
    email,
    role: "student",
    hoursRendered: 0,
    hoursRequired,
    createdAt: serverTimestamp(),
  })
  return credential.user.uid
}

// Remove intern (Firestore doc only — Auth deletion requires admin SDK)
export async function removeIntern(uid) {
  await deleteDoc(doc(db, "users", uid))
}

// Update intern hours
export async function updateHours(uid, hoursToAdd) {
  const userRef = doc(db, "users", uid)
  const snap    = await getDoc(userRef)
  if (snap.exists()) {
    const current = snap.data().hoursRendered || 0
    await updateDoc(userRef, { hoursRendered: current + hoursToAdd })
  }
}

// ────────────────────────────────────────────
// ATTENDANCE (Firestore: "attendance" collection)
// ────────────────────────────────────────────
// Each attendance doc looks like:
// {
//   uid: "user-id",
//   date: "2026-02-26",
//   timeIn: timestamp,
//   timeOut: timestamp | null,
//   duration: "8h 30m" | null,
//   status: "complete" | "late" | "absent"
// }

// Time In — creates a new attendance record
export async function timeIn(uid) {
  const today   = new Date().toISOString().split("T")[0]
  const docRef  = doc(db, "attendance", `${uid}_${today}`)
  const snap    = await getDoc(docRef)
  if (snap.exists()) throw new Error("Already timed in today.")

  const now     = new Date()
  const hour    = now.getHours()
  const status  = hour >= 9 ? "late" : "complete" // after 9AM = late

  await setDoc(docRef, {
    uid,
    date: today,
    timeIn: serverTimestamp(),
    timeOut: null,
    duration: null,
    status,
  })
  return { date: today, status }
}

// Time Out — updates the existing attendance record
export async function timeOut(uid) {
  const today  = new Date().toISOString().split("T")[0]
  const docRef = doc(db, "attendance", `${uid}_${today}`)
  const snap   = await getDoc(docRef)
  if (!snap.exists()) throw new Error("No time-in record found for today.")

  const data       = snap.data()
  const timeInDate = data.timeIn.toDate()
  const now        = new Date()
  const diffMs     = now - timeInDate
  const diffH      = Math.floor(diffMs / 3600000)
  const diffM      = Math.floor((diffMs % 3600000) / 60000)
  const duration   = `${diffH}h ${diffM.toString().padStart(2, "0")}m`

  await updateDoc(docRef, {
    timeOut: serverTimestamp(),
    duration,
  })

  // Update total hours on the user doc
  await updateHours(uid, diffH + diffM / 60)

  return { duration }
}

// Get attendance logs for a user
export async function getAttendanceLogs(uid) {
  const q    = query(
    collection(db, "attendance"),
    where("uid", "==", uid),
    orderBy("date", "desc")
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ────────────────────────────────────────────
// TASKS (Firestore: "tasks" collection)
// ────────────────────────────────────────────
// Each task doc looks like:
// {
//   internUid: "user-id",
//   title: "Fix login bug",
//   desc: "...",
//   priority: "high" | "medium" | "low",
//   status: "pending" | "in-progress" | "done",
//   assignedBy: "Sir Reyes",
//   createdAt: timestamp
// }

// Get tasks for a specific intern
export async function getTasksForIntern(uid) {
  const q    = query(collection(db, "tasks"), where("internUid", "==", uid), orderBy("createdAt", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Get all tasks (admin view)
export async function getAllTasks() {
  const snap = await getDocs(collection(db, "tasks"))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Assign a new task
export async function assignTask(internUid, title, desc, priority, assignedBy) {
  const ref = await addDoc(collection(db, "tasks"), {
    internUid,
    title,
    desc,
    priority,
    status: "pending",
    assignedBy,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// Update task status (used by intern)
export async function updateTaskStatus(taskId, status) {
  await updateDoc(doc(db, "tasks", taskId), { status })
}