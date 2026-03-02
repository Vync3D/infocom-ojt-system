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

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)

// Secondary app — used ONLY for creating new intern accounts
// This prevents Firebase from auto-signing in the new user and kicking out the admin
const secondaryApp  = initializeApp(firebaseConfig, 'secondary')
const secondaryAuth = getAuth(secondaryApp)

// ────────────────────────────────────────────
// GEOFENCE CONFIG
// ────────────────────────────────────────────
const OFFICE = { lat: 9.285833, lng: 123.267417 }
const RADIUS_METERS = 50

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R    = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat/2) * Math.sin(dLat/2) +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dLng/2) * Math.sin(dLng/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Returns { allowed: bool, distance: number }
export function checkGeofence(lat, lng) {
  const distance = getDistanceMeters(lat, lng, OFFICE.lat, OFFICE.lng)
  return { allowed: distance <= RADIUS_METERS, distance: Math.round(distance) }
}

// Get current position as a Promise
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      if (err.code === 1) reject(new Error('Location permission denied. Please allow location access.'))
      else if (err.code === 2) reject(new Error('Location unavailable. Try again.'))
      else reject(new Error('Location request timed out. Try again.'))
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  })
}

// ────────────────────────────────────────────
// SHIFT HELPERS
// ────────────────────────────────────────────
// shift: 'day' | 'gy'
// Day shift  — late after 9:00 AM
// GY shift   — late after 10:00 PM

function isLate(shift, date) {
  const hour = date.getHours()
  const min  = date.getMinutes()
  if (shift === 'gy') return hour < 18 ? false : (hour > 22 || (hour === 22 && min > 0))
  // day shift: late after 9:00 AM
  return hour > 9 || (hour === 9 && min > 0)
}

// For GY shift: if intern times in at night, the "date" should be the night's date
// e.g. timing in at 10 PM on Jan 1 → record date is Jan 1
// e.g. timing out at 6 AM on Jan 2 → still belongs to Jan 1's record
function getShiftDate(shift) {
  const now  = new Date()
  const hour = now.getHours()
  // For GY shift: if it's early morning (before noon), the shift belongs to yesterday
  if (shift === 'gy' && hour < 12) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }
  return now.toISOString().split('T')[0]
}

// ────────────────────────────────────────────
// AUTH
// ────────────────────────────────────────────
export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  const userDoc    = await getDoc(doc(db, "users", credential.user.uid))
  if (!userDoc.exists()) throw new Error("User record not found.")
  return { uid: credential.user.uid, ...userDoc.data() }
}

export async function logoutUser() {
  await signOut(auth)
}

// ────────────────────────────────────────────
// USERS
// ────────────────────────────────────────────
export async function getUser(uid) {
  const snap = await getDoc(doc(db, "users", uid))
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null
}

export async function getAllInterns() {
  const q    = query(collection(db, "users"), where("role", "==", "student"))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
}

// shift: 'day' | 'gy'
export async function addIntern(email, password, name, hoursRequired = 600, shift = 'day') {
  // Use secondary auth instance so the admin session is NOT affected
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  await setDoc(doc(db, "users", credential.user.uid), {
    name, email, role: "student", shift,
    hoursRendered: 0, hoursRequired,
    createdAt: serverTimestamp(),
  })
  // Sign out of secondary app immediately after — clean up
  await signOut(secondaryAuth)
  return credential.user.uid
}

export async function removeIntern(uid) {
  await deleteDoc(doc(db, "users", uid))
}

export async function updateHours(uid, hoursToAdd) {
  const userRef = doc(db, "users", uid)
  const snap    = await getDoc(userRef)
  if (snap.exists()) {
    const current = snap.data().hoursRendered || 0
    await updateDoc(userRef, { hoursRendered: current + hoursToAdd })
  }
}

// Update intern shift
export async function updateInternShift(uid, shift) {
  await updateDoc(doc(db, "users", uid), { shift })
}

// ────────────────────────────────────────────
// ATTENDANCE
// ────────────────────────────────────────────

// Time In — checks geofence first, then records attendance
export async function timeIn(uid, shift = 'day') {
  // 1. Geofence check
  const position = await getCurrentPosition()
  const { allowed, distance } = checkGeofence(
    position.coords.latitude,
    position.coords.longitude
  )
  if (!allowed) {
    throw new Error(`You are ${distance}m away from the office. You must be within ${RADIUS_METERS}m to time in.`)
  }

  // 2. Check if already timed in today
  const today  = getShiftDate(shift)
  const docRef = doc(db, "attendance", `${uid}_${today}`)
  const snap   = await getDoc(docRef)
  if (snap.exists()) throw new Error("Already timed in today.")

  // 3. Record attendance
  const now    = new Date()
  const status = isLate(shift, now) ? "late" : "complete"

  await setDoc(docRef, {
    uid,
    date: today,
    shift,
    timeIn: serverTimestamp(),
    timeOut: null,
    duration: null,
    status,
  })
  return { date: today, status }
}

// Time Out — also checks geofence
export async function timeOut(uid, shift = 'day') {
  // 1. Geofence check
  const position = await getCurrentPosition()
  const { allowed, distance } = checkGeofence(
    position.coords.latitude,
    position.coords.longitude
  )
  if (!allowed) {
    throw new Error(`You are ${distance}m away from the office. You must be within ${RADIUS_METERS}m to time out.`)
  }

  // 2. Find today's record
  const today  = getShiftDate(shift)
  const docRef = doc(db, "attendance", `${uid}_${today}`)
  const snap   = await getDoc(docRef)
  if (!snap.exists()) throw new Error("No time-in record found for today.")

  // 3. Calculate duration
  const data       = snap.data()
  const timeInDate = data.timeIn.toDate()
  const now        = new Date()
  const diffMs     = now - timeInDate
  const diffH      = Math.floor(diffMs / 3600000)
  const diffM      = Math.floor((diffMs % 3600000) / 60000)
  const duration   = `${diffH}h ${diffM.toString().padStart(2, "0")}m`

  await updateDoc(docRef, { timeOut: serverTimestamp(), duration })
  await updateHours(uid, diffH + diffM / 60)

  return { duration }
}

export async function getAttendanceLogs(uid) {
  const q    = query(
    collection(db, "attendance"),
    where("uid", "==", uid),
    orderBy("date", "desc")
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getTodayAttendance() {
  const today = new Date().toISOString().split('T')[0]
  // Also check yesterday for GY shift interns who started last night
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yd = yesterday.toISOString().split('T')[0]

  const [todaySnap, ydSnap] = await Promise.all([
    getDocs(query(collection(db, 'attendance'), where('date', '==', today))),
    getDocs(query(collection(db, 'attendance'), where('date', '==', yd))),
  ])

  const todayDocs = todaySnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const ydDocs    = ydSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(d => d.shift === 'gy' && d.timeIn && !d.timeOut) // only active GY records from yesterday

  return [...todayDocs, ...ydDocs]
}

// ────────────────────────────────────────────
// TASKS
// ────────────────────────────────────────────
export async function getTasksForIntern(uid) {
  const q    = query(collection(db, "tasks"), where("internUid", "==", uid), orderBy("createdAt", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getAllTasks() {
  const snap = await getDocs(collection(db, "tasks"))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function assignTask(internUid, title, desc, priority, assignedBy) {
  const ref = await addDoc(collection(db, "tasks"), {
    internUid, title, desc, priority,
    status: "pending",
    assignedBy,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTaskStatus(taskId, status) {
  await updateDoc(doc(db, "tasks", taskId), { status })
}

export async function assignGroupTask(memberUids, leaderUid, title, desc, priority, assignedBy) {
  const ref = await addDoc(collection(db, 'tasks'), {
    type: 'group', memberUids, leaderUid,
    title, desc, priority,
    status: 'pending',
    assignedBy,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getTasksForInternAll(uid) {
  const [soloSnap, groupSnap] = await Promise.all([
    getDocs(query(collection(db, 'tasks'), where('internUid', '==', uid), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'tasks'), where('memberUids', 'array-contains', uid), orderBy('createdAt', 'desc'))),
  ])
  const solo  = soloSnap.docs.map(d => ({ id: d.id, type: 'solo', ...d.data() }))
  const group = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const all   = [...solo, ...group]
  const seen  = new Set()
  return all.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
}