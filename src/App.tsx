import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import EventsLayout from './Layout/EventsLayout'
import EventDashboard from './pages/EventDashboard'
import CreateEvent from './pages/CreateEvent'
import Attendees from './pages/Attendees'
import Account from './pages/Account'
import EditProfile from './pages/EditProfile'
import Login from './pages/LoginPage'
import Signup from './pages/SignUp'
import ProtectedRoute from './components/ProtectedRoute'
import OrganizerEventDiscover from './pages/Organizereventdiscover'
import OrganizerEventDetail from './pages/Organizereventdetail'
import CustomerEventDiscover from './pages/Customereventdiscover'
import CustomerEventDetail from './pages/Customereventdetail'
import CheckoutPage from './pages/Checkout'
import { ThemeProvider } from './context/ThemeContext'


function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Auth routes — public standalone */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Root redirect to events */}
          <Route path="/" element={<Navigate to="/events" replace />} />

          {/* Protected Organizer routes */}
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <EventsLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<EventDashboard />} />
            <Route path="create" element={<CreateEvent />} />
            <Route path="attendees" element={<Attendees />} />
            <Route path="account" element={<Account />} />
            <Route path="account/edit" element={<EditProfile />} />
            <Route path="discover" element={<OrganizerEventDiscover />} />
            <Route path="e/:id" element={<OrganizerEventDetail />} />
          </Route>

          {/* Customer-facing public routes */}
          <Route path="/discover" element={<CustomerEventDiscover />} />
          <Route path="/e/:id" element={<CustomerEventDetail />} />
          <Route path="/checkout/:id" element={<CheckoutPage />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App