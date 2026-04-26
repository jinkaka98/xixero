import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyA0XF-bKB7tK0eBKkXm0oQTIDu31czKNhA",
  authDomain: "ixero-95d56.firebaseapp.com",
  projectId: "ixero-95d56",
  storageBucket: "ixero-95d56.firebasestorage.app",
  messagingSenderId: "1015803439365",
  appId: "1:1015803439365:web:7267b83d2a4faa98baaf6c"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// ─── License Operations ───

export async function getLicenses() {
  const snap = await getDocs(query(collection(db, 'licenses'), orderBy('created_at', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getLicense(id) {
  const snap = await getDoc(doc(db, 'licenses', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function getLicenseByKey(key) {
  const snap = await getDocs(query(collection(db, 'licenses'), where('key', '==', key)))
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

export async function createLicense({ name, days }) {
  const key = generateLicenseKey()
  const now = new Date()
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const data = {
    key,
    name,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    revoked: false,
    machine_id: '',
    last_validated: '',
    features: ['proxy', 'streaming', 'multi_provider'],
    status: 'active'
  }

  const ref = await addDoc(collection(db, 'licenses'), data)
  return { id: ref.id, ...data }
}

export async function revokeLicense(id) {
  await updateDoc(doc(db, 'licenses', id), {
    revoked: true,
    status: 'revoked'
  })
}

export async function validateLicense(key, machineId) {
  const lic = await getLicenseByKey(key)
  if (!lic) return { valid: false, error: 'License not found' }
  if (lic.revoked) return { valid: false, error: 'License revoked' }
  if (new Date(lic.expires_at) < new Date()) return { valid: false, error: 'License expired' }

  // Bind machine ID on first validation
  if (!lic.machine_id && machineId) {
    await updateDoc(doc(db, 'licenses', lic.id), {
      machine_id: machineId,
      last_validated: new Date().toISOString()
    })
  } else if (lic.machine_id && lic.machine_id !== machineId) {
    return { valid: false, error: 'License bound to another machine' }
  } else {
    await updateDoc(doc(db, 'licenses', lic.id), {
      last_validated: new Date().toISOString()
    })
  }

  return {
    valid: true,
    name: lic.name,
    expires_at: lic.expires_at,
    features: lic.features
  }
}

// ─── Dashboard Stats ───

export async function getDashboardStats() {
  const snap = await getDocs(collection(db, 'licenses'))
  const licenses = snap.docs.map(d => d.data())
  const now = new Date()

  let active = 0, revoked = 0, expired = 0
  licenses.forEach(l => {
    if (l.revoked) revoked++
    else if (new Date(l.expires_at) < now) expired++
    else active++
  })

  return {
    total_licenses: licenses.length,
    active_licenses: active,
    revoked,
    expired,
    requests_today: 0
  }
}

// ─── Usage Tracking ───

export async function trackUsage(licenseKey) {
  const today = new Date().toISOString().split('T')[0]
  const docId = `${today}_${licenseKey}`

  try {
    const ref = doc(db, 'usage', docId)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      await updateDoc(ref, {
        requests: (snap.data().requests || 0) + 1,
        last_request: new Date().toISOString()
      })
    } else {
      await addDoc(collection(db, 'usage'), {
        license_key: licenseKey,
        date: today,
        requests: 1,
        last_request: new Date().toISOString()
      })
    }
  } catch (e) {
    console.error('Usage tracking error:', e)
  }
}

// ─── Helpers ───

function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `XIXERO-${segment(5)}-${segment(5)}-${segment(5)}`
}

export { db }
